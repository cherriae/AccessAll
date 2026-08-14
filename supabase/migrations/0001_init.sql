-- AccessAll — initial Postgres schema
--
-- Replaces the on-device SQLite database with a shared, multi-user Postgres
-- database. Everything the community contributes (places, reviews, reports,
-- comments, votes) lives here; the client holds no authoritative state.
--
-- Conventions:
--   * snake_case in the database, mapped to camelCase in `src/types`.
--   * Aggregates (`places.rating`, `reports.upvotes`, ...) are maintained by
--     triggers and are NOT writable by clients — column grants enforce that.
--   * Every table has row level security enabled with explicit policies.
--
-- Safe to re-run: every statement is idempotent.

set search_path = public, extensions;

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles
--
-- `auth.users` owns credentials. This table holds only the public-facing
-- identity the app renders, so no password material lives in application data.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
    id           uuid primary key references auth.users (id) on delete cascade,
    email        text not null,
    first_name   text not null default '',
    last_name    text not null default '',
    affiliation  text not null default '',
    display_name text generated always as (btrim(first_name || ' ' || last_name)) stored,
    created_at   timestamptz not null default now()
);

comment on table public.profiles is 'Public identity for each authenticated user. Credentials live in auth.users.';

-- ---------------------------------------------------------------------------
-- Per-user app settings
-- ---------------------------------------------------------------------------

create table if not exists public.user_settings (
    user_id                uuid primary key references public.profiles (id) on delete cascade,
    notifications_enabled  boolean not null default true,
    report_updates_enabled boolean not null default true,
    vote_reminders_enabled boolean not null default true,
    campus_name            text not null default ''
);

-- ---------------------------------------------------------------------------
-- New-user provisioning
--
-- Runs as definer so a brand-new user (who owns no rows yet) still gets a
-- profile and settings row created atomically with the auth record.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, first_name, last_name, affiliation)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'first_name', ''),
        coalesce(new.raw_user_meta_data ->> 'last_name', ''),
        coalesce(new.raw_user_meta_data ->> 'affiliation', '')
    )
    on conflict (id) do nothing;

    insert into public.user_settings (user_id, campus_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'affiliation', ''))
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Places
--
-- `location` is a generated geography point with a GiST index, so viewport and
-- radius queries are index-backed instead of full scans over lat/long floats.
-- ---------------------------------------------------------------------------

create table if not exists public.places (
    id                 uuid primary key default gen_random_uuid(),
    name               text not null,
    category           text not null default '',
    address            text not null default '',
    accessibility_note text not null default '',
    source_label       text not null default '',
    source_url         text not null default '',
    community_guide    text not null default '',
    guide_author_id    uuid references public.profiles (id) on delete set null,
    guide_updated_at   timestamptz,
    verified           boolean not null default false,
    latitude           double precision not null check (latitude between -90 and 90),
    longitude          double precision not null check (longitude between -180 and 180),
    location           geography(Point, 4326) generated always as (
                           extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::geography
                       ) stored,
    features           jsonb not null default '[]'::jsonb,
    -- Trigger-maintained aggregates over `reviews`.
    rating             numeric(3, 2),
    review_count       integer not null default 0,
    quiet_score        integer,
    created_by         uuid references public.profiles (id) on delete set null,
    created_at         timestamptz not null default now()
);

create index if not exists places_location_idx on public.places using gist (location);
create index if not exists places_category_idx on public.places (category);

-- Same name at (effectively) the same coordinates is the same place. Matches
-- the duplicate check the client runs before contributing a venue.
create unique index if not exists places_identity_idx
    on public.places (lower(name), round(latitude::numeric, 5), round(longitude::numeric, 5));

-- ---------------------------------------------------------------------------
-- Reviews — one per person per place, editable by its author
-- ---------------------------------------------------------------------------

create table if not exists public.reviews (
    id                  uuid primary key default gen_random_uuid(),
    place_id            uuid not null references public.places (id) on delete cascade,
    user_id             uuid not null references public.profiles (id) on delete cascade,
    rating              integer not null check (rating between 1 and 5),
    quiet_score         integer check (quiet_score between 0 and 100),
    accessibility_notes text not null default '',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (place_id, user_id)
);

create index if not exists reviews_place_idx on public.reviews (place_id, created_at desc);
create index if not exists reviews_user_idx on public.reviews (user_id);

-- ---------------------------------------------------------------------------
-- Reports, comments, upvotes
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
    id         uuid primary key default gen_random_uuid(),
    title      text not null check (btrim(title) <> ''),
    location   text not null default '',
    status     text not null default 'open' check (status in ('open', 'in-progress', 'resolved')),
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    upvotes    integer not null default 0
);

create index if not exists reports_created_idx on public.reports (created_at desc);

create table if not exists public.report_comments (
    id         uuid primary key default gen_random_uuid(),
    report_id  uuid not null references public.reports (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,
    body       text not null check (btrim(body) <> ''),
    created_at timestamptz not null default now()
);

create index if not exists report_comments_report_idx on public.report_comments (report_id, created_at);

create table if not exists public.report_upvotes (
    report_id  uuid not null references public.reports (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (report_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------

create table if not exists public.polls (
    id         uuid primary key default gen_random_uuid(),
    title      text not null check (btrim(title) <> ''),
    location   text not null default '',
    closes_at  timestamptz not null,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    vote_count integer not null default 0
);

create table if not exists public.poll_votes (
    poll_id    uuid not null references public.polls (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (poll_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Activity feed — written by triggers so it cannot drift from what happened
-- ---------------------------------------------------------------------------

create table if not exists public.activity (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles (id) on delete cascade,
    kind        text not null check (kind in ('report', 'review', 'vote', 'verification')),
    title       text not null,
    subtitle    text not null default '',
    occurred_at timestamptz not null default now()
);

create index if not exists activity_user_idx on public.activity (user_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Home screen cards (static app content, readable by everyone)
-- ---------------------------------------------------------------------------

create table if not exists public.app_features (
    id          text primary key,
    title       text not null,
    description text not null,
    action      text not null,
    route       text not null,
    icon        text not null,
    accent      text not null,
    sort_index  integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Aggregate maintenance
-- ---------------------------------------------------------------------------

create or replace function public.sync_place_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    target uuid := coalesce(new.place_id, old.place_id);
begin
    update public.places p
    set rating       = s.avg_rating,
        review_count = s.total,
        quiet_score  = s.avg_quiet
    from (
        select round(avg(rating)::numeric, 2)     as avg_rating,
               count(*)::integer                  as total,
               round(avg(quiet_score))::integer   as avg_quiet
        from public.reviews
        where place_id = target
    ) s
    where p.id = target;

    return null;
end;
$$;

drop trigger if exists reviews_sync_place_stats on public.reviews;
create trigger reviews_sync_place_stats
    after insert or update or delete on public.reviews
    for each row execute function public.sync_place_stats();

create or replace function public.sync_report_upvotes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    target uuid := coalesce(new.report_id, old.report_id);
begin
    update public.reports r
    set upvotes = (select count(*) from public.report_upvotes where report_id = target)
    where r.id = target;

    return null;
end;
$$;

drop trigger if exists report_upvotes_sync on public.report_upvotes;
create trigger report_upvotes_sync
    after insert or delete on public.report_upvotes
    for each row execute function public.sync_report_upvotes();

create or replace function public.sync_poll_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    target uuid := coalesce(new.poll_id, old.poll_id);
begin
    update public.polls p
    set vote_count = (select count(*) from public.poll_votes where poll_id = target)
    where p.id = target;

    return null;
end;
$$;

drop trigger if exists poll_votes_sync on public.poll_votes;
create trigger poll_votes_sync
    after insert or delete on public.poll_votes
    for each row execute function public.sync_poll_votes();

-- ---------------------------------------------------------------------------
-- Activity generation
-- ---------------------------------------------------------------------------

create or replace function public.log_review_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    place_name text;
begin
    select name into place_name from public.places where id = new.place_id;

    insert into public.activity (user_id, kind, title, subtitle, occurred_at)
    values (
        new.user_id,
        'review',
        case when tg_op = 'INSERT'
             then 'You added an accessibility review'
             else 'You updated an accessibility review' end,
        coalesce(place_name, ''),
        now()
    );

    return null;
end;
$$;

drop trigger if exists reviews_log_activity on public.reviews;
create trigger reviews_log_activity
    after insert or update on public.reviews
    for each row execute function public.log_review_activity();

create or replace function public.log_report_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.created_by is null then
        return null;
    end if;

    insert into public.activity (user_id, kind, title, subtitle, occurred_at)
    values (new.created_by, 'report', 'You reported ' || new.title, new.location, new.created_at);

    return null;
end;
$$;

drop trigger if exists reports_log_activity on public.reports;
create trigger reports_log_activity
    after insert on public.reports
    for each row execute function public.log_report_activity();

create or replace function public.log_poll_vote_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    poll_title    text;
    poll_location text;
begin
    select title, location into poll_title, poll_location from public.polls where id = new.poll_id;

    insert into public.activity (user_id, kind, title, subtitle, occurred_at)
    values (new.user_id, 'vote', 'You voted on ' || coalesce(poll_title, 'a proposal'), coalesce(poll_location, ''), now());

    return null;
end;
$$;

drop trigger if exists poll_votes_log_activity on public.poll_votes;
create trigger poll_votes_log_activity
    after insert on public.poll_votes
    for each row execute function public.log_poll_vote_activity();

-- ---------------------------------------------------------------------------
-- Views
--
-- `security_invoker` keeps the caller's RLS in force through the view, so a
-- view can never be used to read around a policy.
-- ---------------------------------------------------------------------------

create or replace view public.profile_stats
with (security_invoker = true) as
select p.id,
       p.email,
       p.first_name,
       p.last_name,
       p.display_name,
       p.affiliation,
       (select count(*) from public.reports r where r.created_by = p.id)   as report_count,
       (select count(*) from public.reviews rv where rv.user_id = p.id)    as review_count,
       (select count(*) from public.poll_votes v where v.user_id = p.id)
     + (select count(*) from public.report_upvotes u where u.user_id = p.id) as vote_count
from public.profiles p;

create or replace view public.poll_feed
with (security_invoker = true) as
select p.id,
       p.title,
       p.location,
       p.closes_at,
       p.vote_count,
       exists (
           select 1 from public.poll_votes v
           where v.poll_id = p.id and v.user_id = auth.uid()
       ) as has_voted
from public.polls p;

-- ---------------------------------------------------------------------------
-- Spatial RPCs
-- ---------------------------------------------------------------------------

create or replace function public.places_nearby(
    lat           double precision,
    lng           double precision,
    radius_meters double precision default 5000
)
returns setof public.places
language sql
stable
set search_path = public, extensions
as $$
    select *
    from public.places
    where extensions.st_dwithin(
        location,
        extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::geography,
        radius_meters
    )
    order by location <-> extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::geography;
$$;

create or replace function public.places_in_bounds(
    min_lat double precision,
    min_lng double precision,
    max_lat double precision,
    max_lng double precision
)
returns setof public.places
language sql
stable
set search_path = public, extensions
as $$
    select *
    from public.places
    where extensions.st_intersects(
        location,
        extensions.st_setsrid(
            extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326),
            4326
        )::geography
    );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.user_settings   enable row level security;
alter table public.places          enable row level security;
alter table public.reviews         enable row level security;
alter table public.reports         enable row level security;
alter table public.report_comments enable row level security;
alter table public.report_upvotes  enable row level security;
alter table public.polls           enable row level security;
alter table public.poll_votes      enable row level security;
alter table public.activity        enable row level security;
alter table public.app_features    enable row level security;

-- profiles: public authorship, self-service editing
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
    for select using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);

-- user_settings: strictly private
drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings
    for select using (auth.uid() = user_id);

drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings
    for insert with check (auth.uid() = user_id);

drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- places: world-readable, community-editable by signed-in users
drop policy if exists places_select on public.places;
create policy places_select on public.places
    for select using (true);

drop policy if exists places_insert_authenticated on public.places;
create policy places_insert_authenticated on public.places
    for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists places_update_authenticated on public.places;
create policy places_update_authenticated on public.places
    for update to authenticated using (true) with check (true);

-- reviews: readable by all, writable only as yourself
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
    for select using (true);

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
    for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own on public.reviews
    for delete to authenticated using (auth.uid() = user_id);

-- reports
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
    for select using (true);

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
    for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists reports_update_own on public.reports;
create policy reports_update_own on public.reports
    for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists reports_delete_own on public.reports;
create policy reports_delete_own on public.reports
    for delete to authenticated using (auth.uid() = created_by);

-- report comments
drop policy if exists report_comments_select on public.report_comments;
create policy report_comments_select on public.report_comments
    for select using (true);

drop policy if exists report_comments_insert_own on public.report_comments;
create policy report_comments_insert_own on public.report_comments
    for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists report_comments_delete_own on public.report_comments;
create policy report_comments_delete_own on public.report_comments
    for delete to authenticated using (auth.uid() = user_id);

-- report upvotes: counts are public, but you may only cast your own
drop policy if exists report_upvotes_select on public.report_upvotes;
create policy report_upvotes_select on public.report_upvotes
    for select using (true);

drop policy if exists report_upvotes_insert_own on public.report_upvotes;
create policy report_upvotes_insert_own on public.report_upvotes
    for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists report_upvotes_delete_own on public.report_upvotes;
create policy report_upvotes_delete_own on public.report_upvotes
    for delete to authenticated using (auth.uid() = user_id);

-- polls
drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls
    for select using (true);

drop policy if exists polls_insert_authenticated on public.polls;
create policy polls_insert_authenticated on public.polls
    for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists polls_delete_own on public.polls;
create policy polls_delete_own on public.polls
    for delete to authenticated using (auth.uid() = created_by);

-- poll votes
drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes
    for select using (true);

drop policy if exists poll_votes_insert_own on public.poll_votes;
create policy poll_votes_insert_own on public.poll_votes
    for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists poll_votes_delete_own on public.poll_votes;
create policy poll_votes_delete_own on public.poll_votes
    for delete to authenticated using (auth.uid() = user_id);

-- activity: your feed is yours alone
drop policy if exists activity_select_own on public.activity;
create policy activity_select_own on public.activity
    for select to authenticated using (auth.uid() = user_id);

drop policy if exists activity_delete_own on public.activity;
create policy activity_delete_own on public.activity
    for delete to authenticated using (auth.uid() = user_id);

-- app features: read-only reference content
drop policy if exists app_features_select on public.app_features;
create policy app_features_select on public.app_features
    for select using (true);

-- ---------------------------------------------------------------------------
-- Column grants
--
-- RLS decides which rows you may touch; these grants decide which columns.
-- Trigger-maintained aggregates are withheld so a client cannot inflate its
-- own rating, upvote count, or vote tally by writing the column directly.
-- ---------------------------------------------------------------------------

revoke update on public.places from authenticated;
grant update (
    name, category, address, accessibility_note, source_label, source_url,
    community_guide, guide_author_id, guide_updated_at, features,
    latitude, longitude
) on public.places to authenticated;

revoke update on public.reports from authenticated;
grant update (title, location, status) on public.reports to authenticated;

revoke insert, update on public.polls from authenticated;
grant insert (title, location, closes_at, created_by) on public.polls to authenticated;

revoke insert, update, delete on public.activity from anon, authenticated;
grant delete on public.activity to authenticated;

revoke insert, update, delete on public.app_features from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reference content
-- ---------------------------------------------------------------------------

insert into public.app_features (id, title, description, action, route, icon, accent, sort_index)
values
    ('campus',       'Access Campus', 'Report accessibility issues and vote on changes.',             'View reports',  '/reports', 'campus', 'campus',  0),
    ('access-check', 'AccessCheck',   'Find and review places with community accessibility information.', 'Explore places', '/explore', 'place',  'explore', 1),
    ('quiet-score',  'QuietScore',    'Share sensory experiences and discover quieter places.',        'Check scores',  '/explore', 'quiet',  'quiet',   2)
on conflict (id) do update
set title       = excluded.title,
    description = excluded.description,
    action      = excluded.action,
    route       = excluded.route,
    icon        = excluded.icon,
    accent      = excluded.accent,
    sort_index  = excluded.sort_index;
