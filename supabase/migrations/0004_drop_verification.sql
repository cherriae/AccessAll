-- Remove the verification feature.
--
-- `places.verified` was never writable by any client (deliberately — a place
-- must not be able to award itself a trust badge) and no moderation workflow
-- existed to set it, so the column could only ever be false. Shipping a
-- "Accessibility Verified" badge that means nothing is worse than shipping no
-- badge at all, particularly for people deciding whether a venue is usable.
--
-- The `verification` activity kind goes for the same reason: nothing could
-- produce one.
--
-- Reversible: re-adding the column is `alter table ... add column verified
-- boolean not null default false`, but any future version should come with an
-- actual moderator role and audit trail.

set search_path = public, extensions;

-- The view selects the column, so it has to be rebuilt around the drop — and
-- both spatial functions return `setof place_feed`, so Postgres will refuse to
-- drop the view while they exist. Take them down first, rebuild both below.
drop function if exists public.places_nearby(double precision, double precision, double precision);
drop function if exists public.places_in_bounds(double precision, double precision, double precision, double precision);
drop view if exists public.place_feed;

alter table public.places drop column if exists verified;

create view public.place_feed
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
       coalesce(nullif(author.display_name, ''), '') as guide_author,
       p.latitude,
       p.longitude,
       p.features,
       p.rating,
       p.review_count,
       p.quiet_score,
       p.created_at
from public.places p
left join public.profiles author on author.id = p.guide_author_id;

grant select on public.place_feed to anon, authenticated;

-- `places_nearby` / `places_in_bounds` return `setof place_feed`, so dropping
-- the view dropped them too. Recreate both against the rebuilt view.
create or replace function public.places_nearby(
    lat           double precision,
    lng           double precision,
    radius_meters double precision default 5000
)
returns setof public.place_feed
language sql
stable
set search_path = public, extensions
as $$
    select f.*
    from public.place_feed f
    join public.places p on p.id = f.id
    where extensions.st_dwithin(
        p.location,
        extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::geography,
        radius_meters
    )
    order by p.location <-> extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::geography;
$$;

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
    );
$$;

grant execute on function public.places_nearby(double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.places_in_bounds(double precision, double precision, double precision, double precision) to anon, authenticated;

-- Narrow the activity kinds to the three that triggers actually write.
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
    check (kind in ('report', 'review', 'vote'));
