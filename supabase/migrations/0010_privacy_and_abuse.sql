-- Privacy and abuse hardening, from a security review before the mobile
-- release. AccessAll's users are mostly minors, and what they mark as
-- "affecting me" can reveal a disability, so the bar is: nobody can learn more
-- about a student than the student chose to show.
--
--   1. Public names become "First L." and affiliation is private. Your own
--      full profile is read through `profile_stats`, now limited to you.
--   2. Who upvoted a report or voted on a poll is private; the counts stay
--      public (they are denormalised onto the report and poll).
--   3. Per-user rate limits on everything a person can post.
--   4. A report's title and location lock once other people have backed it or
--      staff have responded, so the text cannot be swapped under them.
--   5. Smaller gaps: a review cannot move between places, votes cannot be
--      withdrawn after a poll closes, profile columns are write-limited,
--      internal helper functions are not callable through the API, the unused
--      radius search is dropped, staff can keep another staff member's photo,
--      and people can list their own photos (needed to delete them with their
--      account).
--
-- Safe to re-run.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Public names
-- ---------------------------------------------------------------------------

alter table public.profiles
    add column if not exists public_name text generated always as (
        btrim(first_name || ' ' || case when last_name = '' then '' else left(last_name, 1) || '.' end)
    ) stored;

revoke select on public.profiles from anon, authenticated;
grant select (id, public_name, created_at) on public.profiles to anon, authenticated;

revoke update on public.profiles from authenticated;
grant update (first_name, last_name, affiliation) on public.profiles to authenticated;

-- The signed-in user's own profile and contribution counts.
--
-- Deliberately *not* security_invoker: it must read the caller's own name and
-- affiliation, which the column grants above withhold. The `where` clause is
-- what keeps it safe — it can only ever return the caller's row.
drop view if exists public.profile_stats;
create view public.profile_stats as
select p.id,
       p.first_name,
       p.last_name,
       p.display_name,
       p.affiliation,
       (select count(*) from public.reports r where r.created_by = p.id)   as report_count,
       (select count(*) from public.reviews rv where rv.user_id = p.id)    as review_count,
       (select count(*) from public.poll_votes v where v.user_id = p.id)
     + (select count(*) from public.report_upvotes u where u.user_id = p.id) as vote_count
from public.profiles p
where p.id = auth.uid();

revoke all on public.profile_stats from anon;
grant select on public.profile_stats to authenticated;

-- Feeds show the public name. `create or replace` keeps each view's columns;
-- only the expression behind the author name changes.
create or replace view public.place_feed
with (security_invoker = true) as
select p.id,
       p.name,
       p.category,
       p.address,
       p.accessibility_note,
       p.source_label,
       p.source_url,
       p.community_guide,
       p.guide_updated_at,
       coalesce(nullif(author.public_name, ''), '') as guide_author,
       p.latitude,
       p.longitude,
       p.features,
       p.rating,
       p.review_count,
       p.quiet_score,
       p.created_at
from public.places p
left join public.profiles author on author.id = p.guide_author_id;

create or replace view public.review_feed
with (security_invoker = true) as
select r.id,
       r.place_id,
       r.user_id,
       r.rating,
       r.quiet_score,
       r.accessibility_notes,
       r.created_at,
       coalesce(nullif(p.public_name, ''), 'Community member') as author_name,
       r.updated_at,
       r.quiet_measured
from public.reviews r
join public.profiles p on p.id = r.user_id;

create or replace view public.report_comment_feed
with (security_invoker = true) as
select c.id,
       c.report_id,
       c.user_id,
       c.body,
       c.created_at,
       coalesce(nullif(p.public_name, ''), 'Community member') as author_name
from public.report_comments c
join public.profiles p on p.id = c.user_id;

create or replace view public.direction_feed
with (security_invoker = true) as
select d.id,
       d.place_id,
       d.user_id,
       d.title,
       d.steps,
       d.updated_at,
       coalesce(nullif(p.public_name, ''), 'Community member') as author_name
from public.place_directions d
join public.profiles p on p.id = d.user_id;

-- Comment notifications name the commenter the same way.
create or replace function public.notify_report_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    report_title  text;
    report_author uuid;
    commenter     text;
begin
    select title, created_by into report_title, report_author
    from public.reports where id = new.report_id;

    if report_author is null
       or report_author = new.user_id
       or not public.wants_report_updates(report_author) then
        return null;
    end if;

    select coalesce(nullif(public_name, ''), 'Someone') into commenter
    from public.profiles where id = new.user_id;

    insert into public.activity (user_id, kind, title, subtitle, report_id)
    values (
        report_author,
        'comment',
        coalesce(commenter, 'Someone') || ' commented on ' || report_title,
        left(new.body, 140),
        new.report_id
    );

    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Votes are private
-- ---------------------------------------------------------------------------

drop policy if exists report_upvotes_select on public.report_upvotes;
create policy report_upvotes_select on public.report_upvotes
    for select to authenticated using (auth.uid() = user_id);

drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes
    for select to authenticated using (auth.uid() = user_id);

-- A closed poll's tally is final.
drop policy if exists poll_votes_delete_own on public.poll_votes;
create policy poll_votes_delete_own on public.poll_votes
    for delete to authenticated using (
        auth.uid() = user_id
        and exists (select 1 from public.polls p where p.id = poll_id and p.closes_at > now())
    );

-- ---------------------------------------------------------------------------
-- 3. Rate limits
--
-- One trigger function, configured per table:
--   tg_argv[0] the column holding the author's id
--   tg_argv[1] how many rows they may create ...
--   tg_argv[2] ... within this interval
-- Inserts made without a signed-in user (SQL editor, migrations) are exempt.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    recent integer;
begin
    if auth.uid() is null then
        return new;
    end if;

    execute format(
        'select count(*) from %I.%I where %I = $1 and created_at > now() - $2::interval',
        tg_table_schema, tg_table_name, tg_argv[0]
    )
    into recent
    using auth.uid(), tg_argv[2];

    if recent >= tg_argv[1]::integer then
        raise exception 'You are posting too quickly. Please wait a while and try again.'
            using errcode = 'P0001', hint = 'RATE_LIMITED';
    end if;

    return new;
end;
$$;

drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit before insert on public.reports
    for each row execute function public.enforce_rate_limit('created_by', '10', '1 hour');

drop trigger if exists report_comments_rate_limit on public.report_comments;
create trigger report_comments_rate_limit before insert on public.report_comments
    for each row execute function public.enforce_rate_limit('user_id', '30', '1 hour');

drop trigger if exists polls_rate_limit on public.polls;
create trigger polls_rate_limit before insert on public.polls
    for each row execute function public.enforce_rate_limit('created_by', '5', '1 day');

drop trigger if exists places_rate_limit on public.places;
create trigger places_rate_limit before insert on public.places
    for each row execute function public.enforce_rate_limit('created_by', '30', '1 hour');

drop trigger if exists reviews_rate_limit on public.reviews;
create trigger reviews_rate_limit before insert on public.reviews
    for each row execute function public.enforce_rate_limit('user_id', '30', '1 hour');

drop trigger if exists place_directions_rate_limit on public.place_directions;
create trigger place_directions_rate_limit before insert on public.place_directions
    for each row execute function public.enforce_rate_limit('user_id', '10', '1 hour');

create index if not exists report_comments_user_idx on public.report_comments (user_id, created_at);
create index if not exists reports_created_by_idx on public.reports (created_by, created_at);
create index if not exists place_directions_user_idx on public.place_directions (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 4. Lock a report's wording once others rely on it
-- ---------------------------------------------------------------------------

create or replace function public.lock_engaged_report()
returns trigger
language plpgsql
as $$
begin
    if (new.title is distinct from old.title or new.location is distinct from old.location
        or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude)
       and (old.upvotes > 0 or old.staff_updated_at is not null) then
        raise exception 'This report can no longer be reworded because others have backed it'
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

drop trigger if exists reports_lock_engaged on public.reports;
create trigger reports_lock_engaged
    before update on public.reports
    for each row execute function public.lock_engaged_report();

-- ---------------------------------------------------------------------------
-- 5. Smaller gaps
-- ---------------------------------------------------------------------------

-- An upsert rewrites a review's keys with the same values; actually changing
-- them would leave the old place's rating stale.
create or replace function public.keep_review_keys()
returns trigger
language plpgsql
as $$
begin
    if new.place_id is distinct from old.place_id or new.user_id is distinct from old.user_id then
        raise exception 'A review cannot be moved' using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

drop trigger if exists reviews_keep_keys on public.reviews;
create trigger reviews_keep_keys
    before update on public.reviews
    for each row execute function public.keep_review_keys();

-- Internal helpers: triggers call them as the owner, nobody else needs to.
-- (The pure validators used by check constraints stay executable: a check
-- runs with the inserting user's privileges.)
revoke execute on function public.wants_report_updates(uuid) from public, anon, authenticated;

-- Unused by the app and unbounded.
drop function if exists public.places_nearby(double precision, double precision, double precision);

-- Staff may keep the existing photo when another staff member posted it.
create or replace function public.staff_update_report(
    report_id  uuid,
    new_status text,
    note       text default '',
    photo_path text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    current_photo text;
begin
    if not public.is_staff() then
        raise exception 'Only school staff can do this' using errcode = 'insufficient_privilege';
    end if;

    if new_status not in ('open', 'in-progress', 'resolved') then
        raise exception 'Unknown status' using errcode = 'check_violation';
    end if;

    if length(note) > 2000 then
        raise exception 'Note is too long' using errcode = 'check_violation';
    end if;

    select staff_photo_path into current_photo from public.reports where id = report_id;

    if not found then
        raise exception 'Report not found' using errcode = 'no_data_found';
    end if;

    if photo_path <> '' and photo_path <> current_photo
       and photo_path not like auth.uid()::text || '/%' then
        raise exception 'Photo must be your own upload' using errcode = 'check_violation';
    end if;

    update public.reports
    set status           = new_status,
        staff_note       = btrim(note),
        staff_photo_path = photo_path,
        staff_updated_by = auth.uid(),
        staff_updated_at = now()
    where id = report_id;
end;
$$;

-- Listing your own folder, so the app can delete your photos with your account.
drop policy if exists photos_select_own on storage.objects;
create policy photos_select_own on storage.objects
    for select to authenticated
    using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Mark the feed as read using the server's clock, which is the clock the
-- feed's timestamps come from.
create or replace function public.mark_activity_seen()
returns void
language sql
security definer
set search_path = public
as $$
    update public.user_settings set activity_seen_at = now() where user_id = auth.uid();
$$;

revoke execute on function public.mark_activity_seen() from public, anon;
grant execute on function public.mark_activity_seen() to authenticated;
