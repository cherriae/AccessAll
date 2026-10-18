-- Close the gaps between what the client is trusted to do and what the
-- database actually lets it do.
--
-- Before this migration:
--
--   1. `profiles` was world-readable including `email`, so anyone holding the
--      publishable key could list every user's address.
--   2. Any signed-in user could rewrite any place's name, coordinates, source
--      link and guide author.
--   3. Trigger-owned aggregates were protected from UPDATE but not from INSERT,
--      so a client could create a place with a forged rating or a report with
--      a forged upvote count and timestamp.
--   4. "Every report and poll has a confirmed location" was enforced only by
--      the composer, not by the database.
--   5. Polls accepted any closing date and accepted votes after closing.
--   6. Free text had no length limit and `features`/`source_url` had no shape,
--      so one malformed row could break rendering for everyone.
--
-- Constraints that existing rows might violate are added `not valid`: they are
-- enforced for every new or changed row without rejecting the migration over
-- data written under the old rules.
--
-- Safe to re-run.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Email is private
--
-- `auth.users` already holds the address and the signed-in user reads their
-- own from the session, so nothing needs `profiles.email` to be readable.
-- `profile_stats` has to lose the column before the grant is narrowed, or the
-- (security_invoker) view would fail for everyone.
-- ---------------------------------------------------------------------------

drop view if exists public.profile_stats;

create view public.profile_stats
with (security_invoker = true) as
select p.id,
       p.first_name,
       p.last_name,
       p.display_name,
       p.affiliation,
       (select count(*) from public.reports r where r.created_by = p.id)   as report_count,
       (select count(*) from public.reviews rv where rv.user_id = p.id)    as review_count,
       (select count(*) from public.poll_votes v where v.user_id = p.id)
     + (select count(*) from public.report_upvotes u where u.user_id = p.id) as vote_count
from public.profiles p;

grant select on public.profile_stats to anon, authenticated;

revoke select on public.profiles from anon, authenticated;
grant select (id, first_name, last_name, affiliation, display_name, created_at)
    on public.profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Places: the community edits the guide, not the venue
--
-- The guide and feature list stay community-editable — that is the point of
-- them. Identity (name, coordinates, source) is fixed at creation. Who wrote
-- the guide and when is stamped here rather than trusted from the client, so
-- nobody can attribute a guide to someone else.
-- ---------------------------------------------------------------------------

revoke update on public.places from authenticated;
grant update (community_guide, features) on public.places to authenticated;

create or replace function public.stamp_place_guide()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    -- Ticking a feature box does not take over authorship of someone else's prose.
    if new.community_guide is distinct from old.community_guide then
        new.guide_author_id  := auth.uid();
        new.guide_updated_at := now();
    end if;

    return new;
end;
$$;

drop trigger if exists places_stamp_guide on public.places;
create trigger places_stamp_guide
    before update on public.places
    for each row execute function public.stamp_place_guide();

-- ---------------------------------------------------------------------------
-- 3. Inserts may only write the columns a person actually authors
--
-- `id` stays insertable so a client may choose its own key and retry a write
-- without creating a duplicate; a clash is just a primary-key error.
-- ---------------------------------------------------------------------------

revoke insert on public.places from authenticated;
grant insert (
    id, name, category, address, accessibility_note, source_label, source_url,
    latitude, longitude, features, created_by
) on public.places to authenticated;

revoke insert on public.reports from authenticated;
grant insert (id, title, location, latitude, longitude, created_by)
    on public.reports to authenticated;

revoke insert on public.polls from authenticated;
grant insert (id, title, location, latitude, longitude, closes_at, created_by)
    on public.polls to authenticated;

revoke insert, update on public.reviews from authenticated;
grant insert (place_id, user_id, rating, quiet_score, accessibility_notes)
    on public.reviews to authenticated;
-- An upsert's `on conflict do update` rewrites every supplied column, keys
-- included. RLS still pins `user_id` to the caller.
grant update (place_id, user_id, rating, quiet_score, accessibility_notes)
    on public.reviews to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
    before update on public.reviews
    for each row execute function public.touch_updated_at();

revoke insert on public.report_comments from authenticated;
grant insert (report_id, user_id, body) on public.report_comments to authenticated;

revoke insert on public.report_upvotes from authenticated;
grant insert (report_id, user_id) on public.report_upvotes to authenticated;

revoke insert on public.poll_votes from authenticated;
grant insert (poll_id, user_id) on public.poll_votes to authenticated;

-- ---------------------------------------------------------------------------
-- 4. New reports and polls must carry coordinates
--
-- A trigger on insert, not a `not null` constraint: reports filed before 0005
-- legitimately have none, and a constraint would also block changing their
-- status.
-- ---------------------------------------------------------------------------

create or replace function public.require_coordinates()
returns trigger
language plpgsql
as $$
begin
    if new.latitude is null or new.longitude is null then
        raise exception 'A confirmed location is required'
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

drop trigger if exists reports_require_coordinates on public.reports;
create trigger reports_require_coordinates
    before insert on public.reports
    for each row execute function public.require_coordinates();

drop trigger if exists polls_require_coordinates on public.polls;
create trigger polls_require_coordinates
    before insert on public.polls
    for each row execute function public.require_coordinates();

-- ---------------------------------------------------------------------------
-- 5. Polls close when they say they do
-- ---------------------------------------------------------------------------

create or replace function public.check_poll_window()
returns trigger
language plpgsql
as $$
begin
    if new.closes_at <= now() or new.closes_at > now() + interval '1 year' then
        raise exception 'A proposal must close within the next year'
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

drop trigger if exists polls_check_window on public.polls;
create trigger polls_check_window
    before insert on public.polls
    for each row execute function public.check_poll_window();

drop policy if exists poll_votes_insert_own on public.poll_votes;
create policy poll_votes_insert_own on public.poll_votes
    for insert to authenticated with check (
        auth.uid() = user_id
        and exists (
            select 1 from public.polls p
            where p.id = poll_id and p.closes_at > now()
        )
    );

-- ---------------------------------------------------------------------------
-- 6. Shape and size of user-supplied content
-- ---------------------------------------------------------------------------

-- Every entry must have the three string fields the UI renders; an entry
-- missing `label` used to throw inside Explore for every visitor.
create or replace function public.is_valid_features(candidate jsonb)
returns boolean
language sql
immutable
as $$
    -- `case` rather than `and`: SQL does not promise short-circuit evaluation,
    -- and the array functions raise on anything that is not an array.
    select case
        when jsonb_typeof(candidate) <> 'array' then false
        when jsonb_array_length(candidate) > 50 then false
        else not exists (
            select 1
            from jsonb_array_elements(candidate) as elements(item)
            where jsonb_typeof(item) <> 'object'
               or jsonb_typeof(item -> 'id') is distinct from 'string'
               or jsonb_typeof(item -> 'label') is distinct from 'string'
               or jsonb_typeof(item -> 'icon') is distinct from 'string'
               or length(item ->> 'label') > 80
        )
    end;
$$;

alter table public.places drop constraint if exists places_features_shape;
alter table public.places add constraint places_features_shape
    check (public.is_valid_features(features)) not valid;

alter table public.places drop constraint if exists places_source_url_scheme;
alter table public.places add constraint places_source_url_scheme
    check (source_url = '' or source_url ~* '^https?://') not valid;

alter table public.places drop constraint if exists places_text_lengths;
alter table public.places add constraint places_text_lengths
    check (
        length(name) <= 200
        and length(category) <= 100
        and length(address) <= 300
        and length(accessibility_note) <= 2000
        and length(source_label) <= 200
        and length(source_url) <= 2000
        and length(community_guide) <= 5000
    ) not valid;

alter table public.reviews drop constraint if exists reviews_text_lengths;
alter table public.reviews add constraint reviews_text_lengths
    check (length(accessibility_notes) <= 2000) not valid;

alter table public.reports drop constraint if exists reports_text_lengths;
alter table public.reports add constraint reports_text_lengths
    check (length(title) <= 200 and length(location) <= 300) not valid;

alter table public.report_comments drop constraint if exists report_comments_text_lengths;
alter table public.report_comments add constraint report_comments_text_lengths
    check (length(body) <= 2000) not valid;

alter table public.polls drop constraint if exists polls_text_lengths;
alter table public.polls add constraint polls_text_lengths
    check (length(title) <= 200 and length(location) <= 300) not valid;

alter table public.profiles drop constraint if exists profiles_text_lengths;
alter table public.profiles add constraint profiles_text_lengths
    check (length(first_name) <= 80 and length(last_name) <= 80 and length(affiliation) <= 120) not valid;

-- ---------------------------------------------------------------------------
-- Map viewport: cap the result
--
-- Zoomed all the way out, the viewport is the whole planet. Return the
-- best-documented places first rather than every row in the table.
-- ---------------------------------------------------------------------------

create or replace function public.places_in_bounds(
    min_lat double precision,
    min_lng double precision,
    max_lat double precision,
    max_lng double precision
)
returns setof public.place_feed
language sql
stable
set search_path = public, extensions
as $$
    select f.*
    from public.place_feed f
    join public.places p on p.id = f.id
    where extensions.st_intersects(
        p.location,
        extensions.st_setsrid(
            extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326),
            4326
        )::geography
    )
    order by p.review_count desc, p.created_at
    limit 500;
$$;
