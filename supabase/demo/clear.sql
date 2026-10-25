-- AccessAll — remove the demo data added by `supabase/demo/seed.sql`
--
-- Run in the Supabase SQL editor. Deletes only rows with the demo id prefixes;
-- everything that hangs off them (reviews, comments, votes, upvotes, activity,
-- directions, ramp measurements, edit history, staff role) goes by cascade.
-- Real reports and accounts are untouched.

begin;

delete from public.reports where id::text like 'de000002-%';
delete from public.polls   where id::text like 'de000003-%';
delete from public.places  where id::text like 'de000001-%';
delete from auth.users     where id::text like 'de000000-%';

commit;
