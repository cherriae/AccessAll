-- Return the read model, not the base table, from the spatial RPCs.
--
-- `setof public.places` includes the generated `location` column, which
-- PostgREST serialises as a WKB hex blob the client has no use for — and it
-- leaves the guide author as a bare uuid. Returning `place_feed` instead gives
-- callers exactly the shape every other place query already returns.
--
-- The geography filter still runs against `places.location` and its GiST index;
-- the join is on a primary key, so it costs nothing.

set search_path = public, extensions;

drop function if exists public.places_nearby(double precision, double precision, double precision);
drop function if exists public.places_in_bounds(double precision, double precision, double precision, double precision);

create function public.places_nearby(
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

create function public.places_in_bounds(
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
