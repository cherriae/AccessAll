-- Ramp slope measurements and Detour Radar.
--
-- 1. `ramp_measurements`: a ramp's running slope, measured by laying a phone
--    on it. One measurement per person per place (a re-measure replaces it),
--    so the community figure is a median that one person cannot skew.
-- 2. `user_settings.watched_stations`: the subway stations someone relies on.
--    The app checks them against live elevator outages.
-- 3. `impact_summary` gains a count of ramps measured.

-- ---------------------------------------------------------------------------
-- 1. Ramp measurements
-- ---------------------------------------------------------------------------

create table if not exists public.ramp_measurements (
    place_id      uuid not null references public.places (id) on delete cascade,
    user_id       uuid not null references public.profiles (id) on delete cascade,
    -- Rise over run, as a percentage. The ADA limit for a ramp is 8.33% (1:12);
    -- anything over 50% is a staircase or a mis-held phone.
    slope_percent numeric(4, 1) not null check (slope_percent between 0 and 50),
    created_at    timestamptz not null default now(),
    primary key (place_id, user_id)
);

create index if not exists ramp_measurements_user_idx on public.ramp_measurements (user_id, created_at);

alter table public.ramp_measurements enable row level security;

drop policy if exists ramp_measurements_select on public.ramp_measurements;
create policy ramp_measurements_select on public.ramp_measurements
    for select using (true);

drop policy if exists ramp_measurements_insert_own on public.ramp_measurements;
create policy ramp_measurements_insert_own on public.ramp_measurements
    for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists ramp_measurements_update_own on public.ramp_measurements;
create policy ramp_measurements_update_own on public.ramp_measurements
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ramp_measurements_delete_own on public.ramp_measurements;
create policy ramp_measurements_delete_own on public.ramp_measurements
    for delete to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.ramp_measurements from anon, authenticated;
grant insert (place_id, user_id, slope_percent) on public.ramp_measurements to authenticated;
grant update (slope_percent, created_at) on public.ramp_measurements to authenticated;
grant delete on public.ramp_measurements to authenticated;

drop trigger if exists ramp_measurements_rate_limit on public.ramp_measurements;
create trigger ramp_measurements_rate_limit before insert on public.ramp_measurements
    for each row execute function public.enforce_rate_limit('user_id', '20', '1 hour');

-- ---------------------------------------------------------------------------
-- 2. Detour Radar
-- ---------------------------------------------------------------------------

-- MTA station complex ids (e.g. '611'), at most 10.
alter table public.user_settings
    add column if not exists watched_stations text[] not null default '{}';

alter table public.user_settings drop constraint if exists user_settings_watched_stations_valid;
alter table public.user_settings add constraint user_settings_watched_stations_valid
    check (
        cardinality(watched_stations) <= 10
        and array_to_string(watched_stations, ',') ~ '^([0-9]{1,5}(,[0-9]{1,5})*)?$'
    );

grant update (watched_stations) on public.user_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Impact
-- ---------------------------------------------------------------------------

-- Same columns as 0009, plus `ramps_measured` at the end (a view can only gain
-- columns at the end).
create or replace view public.impact_summary
with (security_invoker = true) as
select
    (select count(*) from public.reports)                               as reports_total,
    (select count(*) from public.reports where status = 'resolved')     as reports_resolved,
    (select count(*) from public.reports where status = 'in-progress')  as reports_in_progress,
    (select coalesce(sum(upvotes), 0) from public.reports)              as people_affected,
    (select round((percentile_cont(0.5) within group (
                order by extract(epoch from resolved_at - created_at) / 86400))::numeric, 1)
     from public.reports where resolved_at is not null)                 as median_days_to_resolve,
    (select count(*) from public.places where review_count > 0)         as places_reviewed,
    (select count(*) from public.reviews)                               as reviews_total,
    (select count(*) from public.reviews where quiet_measured)          as sound_measurements,
    (select count(*) from (
        select created_by as person from public.reports where created_by is not null
        union select user_id from public.reviews
        union select user_id from public.report_comments
     ) contributors)                                                    as contributors,
    (select count(*) from public.ramp_measurements)                     as ramps_measured;

grant select on public.impact_summary to anon, authenticated;

notify pgrst, 'reload schema';
