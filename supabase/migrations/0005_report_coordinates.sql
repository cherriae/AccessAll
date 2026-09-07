-- Anchor reports and polls to real coordinates.
--
-- `location` was free text typed into an empty box, so nothing tied a report to
-- a place that exists. Two consequences, both of which this migration and the
-- new location picker fix together:
--
--   1. A report could never be drawn on the map, even though `places` has had
--      indexed geography since 0001.
--   2. "main entrance" and "Main St entrance" were two unrelated strings, so
--      two people reporting one doorway produced two unrelated reports.
--
-- The composer now confirms every location against the geocoder and stores the
-- coordinates it returns. Rows written before this migration keep null
-- coordinates: their `location` text was never verified and must not be
-- back-filled by guessing at what the typist meant.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Columns
--
-- Nullable, unlike `places.latitude`/`longitude`, because the existing rows
-- have no coordinate to give. The paired check is what keeps a half-written
-- location out of the table — a latitude with no longitude is not a location.
-- ---------------------------------------------------------------------------

alter table public.reports
    add column if not exists latitude  double precision,
    add column if not exists longitude double precision;

alter table public.polls
    add column if not exists latitude  double precision,
    add column if not exists longitude double precision;

alter table public.reports drop constraint if exists reports_latitude_range;
alter table public.reports add constraint reports_latitude_range
    check (latitude is null or latitude between -90 and 90);

alter table public.reports drop constraint if exists reports_longitude_range;
alter table public.reports add constraint reports_longitude_range
    check (longitude is null or longitude between -180 and 180);

alter table public.reports drop constraint if exists reports_coordinates_paired;
alter table public.reports add constraint reports_coordinates_paired
    check ((latitude is null) = (longitude is null));

alter table public.polls drop constraint if exists polls_latitude_range;
alter table public.polls add constraint polls_latitude_range
    check (latitude is null or latitude between -90 and 90);

alter table public.polls drop constraint if exists polls_longitude_range;
alter table public.polls add constraint polls_longitude_range
    check (longitude is null or longitude between -180 and 180);

alter table public.polls drop constraint if exists polls_coordinates_paired;
alter table public.polls add constraint polls_coordinates_paired
    check ((latitude is null) = (longitude is null));

-- ---------------------------------------------------------------------------
-- Geography
--
-- Same generated-column-plus-GiST shape as `places.location`, so a viewport
-- query over reports is index-backed rather than a scan over float columns.
-- The generated expression tolerates nulls; `places` does not need to because
-- its coordinates are `not null`.
-- ---------------------------------------------------------------------------

alter table public.reports
    add column if not exists location_point geography(Point, 4326)
    generated always as (
        case
            when latitude is null or longitude is null then null
            else extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::geography
        end
    ) stored;

alter table public.polls
    add column if not exists location_point geography(Point, 4326)
    generated always as (
        case
            when latitude is null or longitude is null then null
            else extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::geography
        end
    ) stored;

create index if not exists reports_location_idx on public.reports using gist (location_point);
create index if not exists polls_location_idx on public.polls using gist (location_point);

-- ---------------------------------------------------------------------------
-- Column grants
--
-- As in 0001: RLS picks the rows, these pick the columns. `location_point` is
-- generated and stays unwritable, so a client cannot desynchronise the pin
-- from the coordinates it is supposed to be derived from.
-- ---------------------------------------------------------------------------

revoke insert, update on public.polls from authenticated;
grant insert (title, location, latitude, longitude, closes_at, created_by)
    on public.polls to authenticated;

revoke update on public.reports from authenticated;
grant update (title, location, latitude, longitude, status)
    on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Views
--
-- `poll_feed` has to expose the coordinates or the client cannot read back what
-- it just wrote. The two columns go on the end rather than next to `location`
-- where they belong: `create or replace view` may append columns but may not
-- reorder or rename the existing ones, and dropping the view to tidy the column
-- order is not worth the window where the feed does not exist.
-- ---------------------------------------------------------------------------

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
       ) as has_voted,
       p.latitude,
       p.longitude
from public.polls p;
