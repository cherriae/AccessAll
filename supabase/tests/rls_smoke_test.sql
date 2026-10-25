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

insert into public.reports (id, title, location, latitude, longitude, created_by)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'Broken lift', 'East wing', 40.6892, -73.9760,
        '11111111-1111-1111-1111-111111111111');

do $$
begin
    insert into public.reports (title, location, created_by)
    values ('No pin', 'Somewhere', '11111111-1111-1111-1111-111111111111');
    insert into checks values ('report without coordinates is rejected', false, 'insert was allowed');
exception when check_violation then
    insert into checks values ('report without coordinates is rejected', true, 'rejected');
end;
$$;

do $$
begin
    insert into public.places (name, latitude, longitude, created_by, rating, review_count)
    values ('Forged', 1, 1, '11111111-1111-1111-1111-111111111111', 5.0, 900);
    insert into checks values ('rating cannot be forged on insert', false, 'insert was allowed');
exception when insufficient_privilege then
    insert into checks values ('rating cannot be forged on insert', true, 'rejected');
end;
$$;

do $$
begin
    insert into public.places (name, latitude, longitude, created_by, features)
    values ('Bad features', 2, 2, '11111111-1111-1111-1111-111111111111', '[{"id":"x"}]'::jsonb);
    insert into checks values ('malformed features are rejected', false, 'insert was allowed');
exception when check_violation then
    insert into checks values ('malformed features are rejected', true, 'rejected');
end;
$$;

do $$
begin
    insert into public.places (name, latitude, longitude, created_by, source_url)
    values ('Bad link', 3, 3, '11111111-1111-1111-1111-111111111111', 'javascript:alert(1)');
    insert into checks values ('non-http source links are rejected', false, 'insert was allowed');
exception when check_violation then
    insert into checks values ('non-http source links are rejected', true, 'rejected');
end;
$$;

do $$
begin
    insert into public.polls (title, location, latitude, longitude, closes_at, created_by)
    values ('Already over', 'East wing', 40.6892, -73.9760, now() - interval '1 day',
            '11111111-1111-1111-1111-111111111111');
    insert into checks values ('poll cannot close in the past', false, 'insert was allowed');
exception when check_violation then
    insert into checks values ('poll cannot close in the past', true, 'rejected');
end;
$$;

insert into public.polls (id, title, location, latitude, longitude, closes_at, created_by)
values ('cccccccc-0000-0000-0000-000000000001', 'Add a ramp', 'East wing', 40.6892, -73.9760,
        now() + interval '7 days', '11111111-1111-1111-1111-111111111111');

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

do $$
begin
    perform email from public.profiles limit 1;
    insert into checks values ('other users'' emails are private', false, 'select was allowed');
exception when insufficient_privilege then
    insert into checks values ('other users'' emails are private', true, 'rejected');
end;
$$;

do $$
begin
    update public.places set name = 'Vandalised' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    insert into checks values ('place identity is not community-editable', false, 'update was allowed');
exception when insufficient_privilege then
    insert into checks values ('place identity is not community-editable', true, 'rejected');
end;
$$;

update public.places set community_guide = 'Ramp at the side door.'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into checks
select 'guide author is stamped by the database',
       guide_author_id = '22222222-2222-2222-2222-222222222222' and guide_updated_at is not null,
       coalesce(guide_author_id::text, 'null')
from public.places where id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into public.poll_votes (poll_id, user_id)
values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');

insert into checks
select 'poll vote is counted', vote_count = 1, vote_count::text
from public.polls where id = 'cccccccc-0000-0000-0000-000000000001';

-- Close the poll behind the client's back, then try to vote again as Alice.
reset role;
update public.polls set closes_at = now() - interval '1 minute'
where id = 'cccccccc-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
begin
    insert into public.poll_votes (poll_id, user_id)
    values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
    insert into checks values ('closed poll rejects votes', false, 'insert was allowed');
exception when insufficient_privilege then
    insert into checks values ('closed poll rejects votes', true, 'rejected');
end;
$$;

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- 0009: staff, directions, access profile.
do $$
begin
    perform public.staff_update_report('bbbbbbbb-0000-0000-0000-000000000001', 'resolved', 'Fixed', '');
    insert into checks values ('non-staff cannot post a staff update', false, 'call was allowed');
exception when insufficient_privilege then
    insert into checks values ('non-staff cannot post a staff update', true, 'rejected');
end;
$$;

do $$
begin
    insert into public.place_directions (place_id, user_id, title, steps)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Side door',
            '[{"text":"Go in","photo":"11111111-1111-1111-1111-111111111111/a.jpg"}]'::jsonb);
    insert into checks values ('directions cannot reuse someone else''s photo', false, 'insert was allowed');
exception when check_violation then
    insert into checks values ('directions cannot reuse someone else''s photo', true, 'rejected');
end;
$$;

insert into public.place_directions (place_id, user_id, title, steps)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Side door',
        '[{"text":"Use the ramp on the left"},{"text":"Elevator B to floor 2","photo":"22222222-2222-2222-2222-222222222222/b.jpg"}]'::jsonb);

insert into checks
select 'directions are readable with author name', count(*) = 1 and bool_and(author_name = 'Bob B.'), count(*)::text
from public.direction_feed where place_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
    update public.user_settings set access_needs = array['wheelchair', 'flying']
    where user_id = '22222222-2222-2222-2222-222222222222';
    insert into checks values ('unknown access needs are rejected', false, 'update was allowed');
exception when check_violation then
    insert into checks values ('unknown access needs are rejected', true, 'rejected');
end;
$$;

-- Make Bob staff (as the project admin would), then resolve Alice's report.
reset role;
insert into public.staff_members (user_id, title) values ('22222222-2222-2222-2222-222222222222', 'Test staff');
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select public.staff_update_report('bbbbbbbb-0000-0000-0000-000000000001', 'resolved', 'Lift repaired', '');

insert into checks
select 'staff update resolves and stamps the report',
       status = 'resolved' and resolved_at is not null and staff_note = 'Lift repaired'
       and staff_updated_by = '22222222-2222-2222-2222-222222222222',
       format('status=%s resolved_at=%s', status, resolved_at)
from public.reports where id = 'bbbbbbbb-0000-0000-0000-000000000001';

insert into checks
select 'impact summary counts the fix', reports_resolved >= 1, reports_resolved::text
from public.impact_summary;

-- Put the report back so the checks below see it as before.
reset role;
update public.reports set status = 'open' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from public.staff_members where user_id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

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
select 'profile_stats only shows your own row', count(*) = 0, count(*)::text
from public.profile_stats where id = '11111111-1111-1111-1111-111111111111';

insert into checks
select 'profile_stats counts your contributions', report_count = 0 and review_count = 1 and vote_count = 2,
       format('reports=%s reviews=%s votes=%s', report_count, review_count, vote_count)
from public.profile_stats where id = '22222222-2222-2222-2222-222222222222';

do $$
begin
    perform last_name from public.profiles limit 1;
    insert into checks values ('last names and affiliation are private', false, 'select was allowed');
exception when insufficient_privilege then
    insert into checks values ('last names and affiliation are private', true, 'rejected');
end;
$$;

insert into checks
select 'who upvoted is private', count(*) = 0, count(*)::text
from public.report_upvotes where user_id <> '22222222-2222-2222-2222-222222222222';

insert into checks
select 'spatial RPC finds the place', count(*) = 1, count(*)::text
from public.places_nearby(40.6892, -73.9760, 500);

insert into checks
select 'spatial RPC excludes distant points', count(*) = 0, count(*)::text
from public.places_nearby(48.8584, 2.2945, 500);

insert into checks
select 'review_feed shows first name and initial', bool_and(author_name in ('Alice A.', 'Bob B.')),
       string_agg(author_name, ', ' order by author_name)
from public.review_feed where place_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- 0011: edit history, revert permission, blocking, content reports.
insert into checks
select 'place edits are logged with the editor', count(*) >= 1 and bool_and(editor_name = 'Bob B.'), count(*)::text
from public.place_edit_feed where place_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
    perform public.revert_place_edit((select id from public.place_edits limit 1));
    insert into checks values ('non-staff cannot revert an edit', false, 'call was allowed');
exception when insufficient_privilege then
    insert into checks values ('non-staff cannot revert an edit', true, 'rejected');
end;
$$;

insert into public.user_blocks (blocker_id, blocked_id)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');

insert into checks
select 'blocked author''s reviews are hidden', count(*) = 0, count(*)::text
from public.reviews where user_id = '11111111-1111-1111-1111-111111111111';

delete from public.user_blocks where blocker_id = '22222222-2222-2222-2222-222222222222';

insert into public.content_reports (reporter_id, target_type, target_id, reason)
values ('22222222-2222-2222-2222-222222222222', 'report', 'bbbbbbbb-0000-0000-0000-000000000001', 'spam');

insert into checks
select 'one content report does not hide anything', count(*) = 1, count(*)::text
from public.reports where id = 'bbbbbbbb-0000-0000-0000-000000000001';

insert into checks
select 'reporters only see their own reports', count(*) = 1, count(*)::text
from public.content_reports;

-- 0013: ramp measurements and Detour Radar, acting as Bob.
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into public.ramp_measurements (place_id, user_id, slope_percent)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 7.5);

insert into checks
select 'ramp measurement saved', count(*) = 1, count(*)::text
from public.ramp_measurements where place_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $
begin
    insert into public.ramp_measurements (place_id, user_id, slope_percent)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 30);
    insert into checks values ('cannot measure as someone else', false, 'insert was allowed');
exception when insufficient_privilege then
    insert into checks values ('cannot measure as someone else', true, 'rejected');
end;
$;

do $
begin
    insert into public.ramp_measurements (place_id, user_id, slope_percent)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 9);
    insert into checks values ('one measurement per person per place', false, 'duplicate was allowed');
exception when unique_violation then
    insert into checks values ('one measurement per person per place', true, 'rejected');
end;
$;

update public.user_settings set watched_stations = array['611', '1']
where user_id = '22222222-2222-2222-2222-222222222222';

insert into checks
select 'watched stations saved', watched_stations = array['611', '1'], array_to_string(watched_stations, ',')
from public.user_settings where user_id = '22222222-2222-2222-2222-222222222222';

do $
begin
    update public.user_settings set watched_stations = array['not-a-station']
    where user_id = '22222222-2222-2222-2222-222222222222';
    insert into checks values ('watched stations must be station ids', false, 'update was allowed');
exception when check_violation then
    insert into checks values ('watched stations must be station ids', true, 'rejected');
end;
$;

-- 0012: hidden content whose author deleted their account stays hidden.
reset role;
insert into public.reports (id, title, location, latitude, longitude, created_by, hidden_at)
values ('bbbbbbbb-0000-0000-0000-000000000099', 'Orphaned', 'Nowhere', 40.6892, -73.9760, null, now());

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

insert into checks
select 'anonymous can browse places', count(*) >= 1, count(*)::text from public.places;

insert into checks
select 'anonymous cannot see hidden orphaned content', count(*) = 0, count(*)::text
from public.reports where id = 'bbbbbbbb-0000-0000-0000-000000000099';

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
