-- Row level security and trigger smoke test.
--
-- Creates two throwaway users, acts as each in turn, and asserts that the
-- policies and triggers in the migrations actually behave as intended. The
-- whole thing runs inside a transaction that is rolled back at the end, so it
-- leaves nothing behind and is safe to run against a live project.
--
-- Run it in the Supabase SQL Editor. Every row of the final result should read
-- ok = true.

begin;

create temp table checks (step text, ok boolean, detail text) on commit drop;
grant all on checks to authenticated, anon;

-- Two users. Inserting into auth.users fires handle_new_user, which is itself
-- one of the things under test.
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
    ('11111111-1111-1111-1111-111111111111', 'alice@example.test', 'authenticated', 'authenticated',
     '{"first_name":"Alice","last_name":"Alvarez","affiliation":"Test School"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', 'bob@example.test', 'authenticated', 'authenticated',
     '{"first_name":"Bob","last_name":"Brook"}'::jsonb);

insert into checks
select 'profile row created by trigger', count(*) = 2, count(*)::text
from public.profiles
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into checks
select 'settings row created by trigger', count(*) = 2, count(*)::text
from public.user_settings
where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into checks
select 'display_name is generated', display_name = 'Alice Alvarez', display_name
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------------------
-- Act as Alice
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.places (id, name, category, latitude, longitude, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Test Library', 'library', 40.6892, -73.9760,
        '11111111-1111-1111-1111-111111111111');

insert into checks select 'signed-in user can add a place', true, 'inserted';

insert into public.reviews (place_id, user_id, rating, quiet_score, accessibility_notes)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 4, 80, 'Step-free entrance.');

insert into checks
select 'review trigger recomputed place stats', rating = 4.00 and review_count = 1 and quiet_score = 80,
       format('rating=%s count=%s quiet=%s', rating, review_count, quiet_score)
from public.places where id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into public.reports (id, title, location, created_by)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'Broken lift', 'East wing',
        '11111111-1111-1111-1111-111111111111');

insert into checks
select 'activity feed written by triggers', count(*) = 2, count(*)::text
from public.activity;

-- A client must not be able to write a trigger-owned aggregate.
do $$
begin
    update public.places set rating = 5.0 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    insert into checks values ('rating column is not client-writable', false, 'update was allowed');
exception when insufficient_privilege then
    insert into checks values ('rating column is not client-writable', true, 'rejected');
end;
$$;

do $$
begin
    update public.reports set upvotes = 999 where id = 'bbbbbbbb-0000-0000-0000-000000000001';
    insert into checks values ('upvotes column is not client-writable', false, 'update was allowed');
exception when insufficient_privilege then
    insert into checks values ('upvotes column is not client-writable', true, 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------
-- Act as Bob
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into checks
select 'community data is world-readable', count(*) = 1, count(*)::text
from public.reviews where place_id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into checks
select 'another user''s activity is private', count(*) = 0, count(*)::text
from public.activity;

insert into checks
select 'another user''s settings are private', count(*) = 0, count(*)::text
from public.user_settings where user_id = '11111111-1111-1111-1111-111111111111';

with attempted as (
    update public.reviews set rating = 1
    where user_id = '11111111-1111-1111-1111-111111111111'
    returning 1
)
insert into checks select 'cannot edit another user''s review', count(*) = 0, count(*)::text from attempted;

-- Bob upvotes Alice's report: allowed, and counted by the trigger.
insert into public.report_upvotes (report_id, user_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');

insert into checks
select 'upvote trigger maintains the count', upvotes = 1, upvotes::text
from public.reports where id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- Bob reviews the same place: the average must move, not the count double-run.
insert into public.reviews (place_id, user_id, rating, quiet_score, accessibility_notes)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 2, 40, 'Heavy doors.');

insert into checks
select 'stats average across reviewers', rating = 3.00 and review_count = 2,
       format('rating=%s count=%s', rating, review_count)
from public.places where id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into checks
select 'profile_stats counts contributions', report_count = 1 and review_count = 1 and vote_count = 0,
       format('reports=%s reviews=%s votes=%s', report_count, review_count, vote_count)
from public.profile_stats where id = '11111111-1111-1111-1111-111111111111';

insert into checks
select 'spatial RPC finds the place', count(*) = 1, count(*)::text
from public.places_nearby(40.6892, -73.9760, 500);

insert into checks
select 'spatial RPC excludes distant points', count(*) = 0, count(*)::text
from public.places_nearby(48.8584, 2.2945, 500);

insert into checks
select 'review_feed resolves the author name', bool_and(author_name in ('Alice Alvarez', 'Bob Brook')),
       string_agg(author_name, ', ' order by author_name)
from public.review_feed where place_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

insert into checks
select 'anonymous can browse places', count(*) >= 1, count(*)::text from public.places;

do $$
begin
    insert into public.places (name, latitude, longitude, created_by)
    values ('Sneaky', 1, 1, '11111111-1111-1111-1111-111111111111');
    insert into checks values ('anonymous cannot add a place', false, 'insert was allowed');
exception when insufficient_privilege then
    insert into checks values ('anonymous cannot add a place', true, 'rejected');
end;
$$;

reset role;

select step, ok, detail from checks order by ok, step;

rollback;
