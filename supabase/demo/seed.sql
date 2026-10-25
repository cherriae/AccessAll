-- AccessAll — demo data for filming
--
-- Fills the app with a month of believable community use around Brooklyn Tech:
-- 12 demo accounts (11 students, 1 staff member), 10 places with reviews,
-- guides, step-free directions and ramp measurements, 14 reports across all
-- three statuses with backers and comments, and 4 open proposals with votes.
--
-- Run the whole file in the Supabase SQL editor, after migrations 0001–0013.
-- It is safe to re-run: it clears the previous demo data first.
-- Remove everything again with `supabase/demo/clear.sql` once you have filmed.
--
-- Optional: put the email you sign in with in `presenter_email` (section 7) and
-- your own account gets two reports of its own, people backing and commenting
-- on them, and a staff fix in your Activity tab.
--
-- The staff account can sign in, for the "staff posts a fix" shot:
--     denise.okafor@demo.accessall.test / AccessAllDemo!2026
-- Every demo account uses that password.
--
-- Demo rows use fixed ids so `clear.sql` can find them:
--     users   de000000-…   places  de000001-…
--     reports de000002-…   polls   de000003-…
--
-- One transaction, so `now()` is the same instant throughout: section 8 relies
-- on that to find the activity rows the triggers stamped with it.

begin;

set local search_path = public, extensions;

create or replace function pg_temp.demo_user(n integer) returns uuid language sql immutable
as $$ select ('de000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

create or replace function pg_temp.demo_place(n integer) returns uuid language sql immutable
as $$ select ('de000001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

create or replace function pg_temp.demo_report(n integer) returns uuid language sql immutable
as $$ select ('de000002-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

create or replace function pg_temp.demo_poll(n integer) returns uuid language sql immutable
as $$ select ('de000003-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- ---------------------------------------------------------------------------
-- 0. Clear the previous run (same statements as clear.sql)
-- ---------------------------------------------------------------------------

delete from public.reports where id::text like 'de000002-%';
delete from public.polls   where id::text like 'de000003-%';
delete from public.places  where id::text like 'de000001-%';
delete from auth.users     where id::text like 'de000000-%';

-- ---------------------------------------------------------------------------
-- 1. Accounts
--
-- `handle_new_user` creates each profile and settings row from the metadata.
-- Users 1–11 are students; user 12 is staff.
-- ---------------------------------------------------------------------------

insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000',
       pg_temp.demo_user(n),
       'authenticated',
       'authenticated',
       lower(first_name || '.' || last_name) || '@demo.accessall.test',
       crypt('AccessAllDemo!2026', gen_salt('bf')),
       now() - joined,
       '{"provider": "email", "providers": ["email"]}'::jsonb,
       jsonb_build_object('first_name', first_name, 'last_name', last_name, 'affiliation', 'Brooklyn Tech'),
       now() - joined,
       now() - joined,
       '', '', '', ''
from (values
    ( 1, 'Maya',    'Chen',    interval '41 days'),
    ( 2, 'Jordan',  'Alvarez', interval '40 days'),
    ( 3, 'Priya',   'Raman',   interval '38 days'),
    ( 4, 'Marcus',  'Johnson', interval '37 days'),
    ( 5, 'Sofia',   'Rossi',   interval '35 days'),
    ( 6, 'Ethan',   'Kim',     interval '33 days'),
    ( 7, 'Aaliyah', 'Brooks',  interval '30 days'),
    ( 8, 'Daniel',  'Park',    interval '27 days'),
    ( 9, 'Fatima',  'Hassan',  interval '24 days'),
    (10, 'Leo',     'Novak',   interval '19 days'),
    (11, 'Grace',   'Liu',     interval '12 days'),
    (12, 'Denise',  'Okafor',  interval '42 days')
) as people (n, first_name, last_name, joined);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', u.created_at, u.created_at, u.created_at
from auth.users u
where u.id::text like 'de000000-%';

update public.profiles p
set created_at = u.created_at
from auth.users u
where u.id = p.id and u.id::text like 'de000000-%';

update public.user_settings s
set access_needs = needs.list
from (values
    ( 1, array['wheelchair']),
    ( 3, array['sensory']),
    ( 5, array['temporary-injury']),
    ( 7, array['low-vision']),
    ( 9, array['deaf']),
    (11, array['wheelchair', 'sensory'])
) as needs (n, list)
where s.user_id = pg_temp.demo_user(needs.n);

insert into public.staff_members (user_id, title, added_at)
values (pg_temp.demo_user(12), 'Assistant Principal, Facilities', now() - interval '42 days');

-- ---------------------------------------------------------------------------
-- 2. Places
-- ---------------------------------------------------------------------------

insert into public.places (
    id, name, category, address, accessibility_note, latitude, longitude, features,
    community_guide, guide_author_id, guide_updated_at, created_by, created_at
)
values
    (pg_temp.demo_place(1), 'Brooklyn Tech — Fort Greene Pl Entrance', 'School',
     '29 Fort Greene Pl, Brooklyn, NY 11217',
     'Ramp entrance with push-button door, left of the main steps.',
     40.68895, -73.97615,
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"},
       {"id": "elevator", "label": "Elevator", "icon": "elevator"},
       {"id": "service-animal", "label": "Service animals welcome", "icon": "service-animal"}]',
     'Skip the main steps: the ramp is about 20 m to the left, past the bike racks. The push button sits on the right-hand rail. Security will radio for Elevator A if you show your elevator pass at the desk.',
     pg_temp.demo_user(1), now() - interval '33 days', pg_temp.demo_user(1), now() - interval '39 days'),

    (pg_temp.demo_place(2), 'Brooklyn Tech — Library', 'School',
     '29 Fort Greene Pl, Brooklyn, NY 11217',
     '3rd floor. Quiet study room at the back can be booked at the desk.',
     40.68915, -73.97680,
     '[{"id": "elevator", "label": "Elevator", "icon": "elevator"},
       {"id": "sensory-support", "label": "Sensory support", "icon": "quiet"},
       {"id": "wheelchair-seating", "label": "Wheelchair seating", "icon": "seating"}]',
     'Take Elevator B to 3, turn right. The two tables nearest the windows are height-adjustable. The back study room is the quietest spot in the building during lunch.',
     pg_temp.demo_user(3), now() - interval '21 days', pg_temp.demo_user(3), now() - interval '36 days'),

    (pg_temp.demo_place(3), 'Brooklyn Tech — Cafeteria', 'School',
     '29 Fort Greene Pl, Brooklyn, NY 11217',
     'Very loud during lunch periods 4–7.',
     40.68870, -73.97700,
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"},
       {"id": "wheelchair-seating", "label": "Wheelchair seating", "icon": "seating"}]',
     '', null, null, pg_temp.demo_user(4), now() - interval '35 days'),

    (pg_temp.demo_place(4), 'Brooklyn Tech — Auditorium', 'School',
     '29 Fort Greene Pl, Brooklyn, NY 11217',
     'Wheelchair spaces marked in row K since the fix this month.',
     40.68930, -73.97720,
     '[{"id": "wheelchair-seating", "label": "Wheelchair seating", "icon": "seating"},
       {"id": "assistive-listening", "label": "Assistive listening", "icon": "hearing"},
       {"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"}]',
     'Use the side doors off the 1st-floor east hallway: no steps. Assistive listening headsets are at the tech booth; ask before the show starts.',
     pg_temp.demo_user(9), now() - interval '11 days', pg_temp.demo_user(9), now() - interval '28 days'),

    (pg_temp.demo_place(5), 'Brooklyn Tech — Gym', 'School',
     '29 Fort Greene Pl, Brooklyn, NY 11217',
     'Elevator access is not signed; see the step-free directions.',
     40.68858, -73.97648,
     '[{"id": "elevator", "label": "Elevator", "icon": "elevator"}]',
     '', null, null, pg_temp.demo_user(6), now() - interval '30 days'),

    (pg_temp.demo_place(6), 'Fort Greene Park', 'Park',
     'Washington Park & Myrtle Ave, Brooklyn, NY 11205',
     'Hilly. The DeKalb Ave paths are the gentlest way up.',
     40.69150, -73.97540,
     '[{"id": "restroom", "label": "Accessible restroom", "icon": "restroom"},
       {"id": "service-animal", "label": "Service animals welcome", "icon": "service-animal"}]',
     'Enter at DeKalb Ave & Washington Park and follow the wide path that curves left: it is longer but much less steep than the stairs to the monument.',
     pg_temp.demo_user(5), now() - interval '18 days', pg_temp.demo_user(5), now() - interval '32 days'),

    (pg_temp.demo_place(7), 'Walt Whitman Library (BPL)', 'Library',
     '93 St Edwards St, Brooklyn, NY 11205',
     'Step-free entrance on St Edwards St.',
     40.69437, -73.97853,
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"},
       {"id": "restroom", "label": "Accessible restroom", "icon": "restroom"},
       {"id": "sensory-support", "label": "Sensory support", "icon": "quiet"}]',
     '', null, null, pg_temp.demo_user(7), now() - interval '26 days'),

    (pg_temp.demo_place(8), 'Atlantic Av–Barclays Ctr Station', 'Transit',
     'Atlantic Ave & Flatbush Ave, Brooklyn, NY 11217',
     'Elevators to most platforms; check outages before you go.',
     40.68446, -73.97689,
     '[{"id": "elevator", "label": "Elevator", "icon": "elevator"},
       {"id": "braille-signage", "label": "Braille signage", "icon": "vision"}]',
     'The street elevator is on the Barclays Center plaza. For the 2/3/4/5, follow the blue accessible-route signs, not the main stairs.',
     pg_temp.demo_user(2), now() - interval '14 days', pg_temp.demo_user(2), now() - interval '38 days'),

    (pg_temp.demo_place(9), 'Barclays Center', 'Arena',
     '620 Atlantic Ave, Brooklyn, NY 11217',
     'Accessible seating on every level; sensory bags at guest services.',
     40.68265, -73.97471,
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"},
       {"id": "elevator", "label": "Elevator", "icon": "elevator"},
       {"id": "restroom", "label": "Accessible restroom", "icon": "restroom"},
       {"id": "wheelchair-seating", "label": "Wheelchair seating", "icon": "seating"},
       {"id": "assistive-listening", "label": "Assistive listening", "icon": "hearing"},
       {"id": "sensory-support", "label": "Sensory support", "icon": "quiet"}]',
     '', null, null, pg_temp.demo_user(8), now() - interval '22 days'),

    (pg_temp.demo_place(10), 'BAM Howard Gilman Opera House', 'Theater',
     '30 Lafayette Ave, Brooklyn, NY 11217',
     'Ask the box office for assistive listening devices.',
     40.68640, -73.97782,
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"},
       {"id": "assistive-listening", "label": "Assistive listening", "icon": "hearing"},
       {"id": "hearing-loop", "label": "Hearing loop", "icon": "hearing"},
       {"id": "wheelchair-seating", "label": "Wheelchair seating", "icon": "seating"}]',
     '', null, null, pg_temp.demo_user(9), now() - interval '16 days');

-- Edit history, so a place page shows the community refining its details.
insert into public.place_edits (place_id, editor_id, old_features, new_features, old_guide, new_guide, created_at)
values
    (pg_temp.demo_place(1), pg_temp.demo_user(1),
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"}]',
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"},
       {"id": "elevator", "label": "Elevator", "icon": "elevator"}]',
     '', 'Skip the main steps: the ramp is about 20 m to the left, past the bike racks.',
     now() - interval '37 days'),
    (pg_temp.demo_place(1), pg_temp.demo_user(1),
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"},
       {"id": "elevator", "label": "Elevator", "icon": "elevator"}]',
     '[{"id": "accessible-entrance", "label": "Accessible entrance", "icon": "ramp"},
       {"id": "elevator", "label": "Elevator", "icon": "elevator"},
       {"id": "service-animal", "label": "Service animals welcome", "icon": "service-animal"}]',
     'Skip the main steps: the ramp is about 20 m to the left, past the bike racks.',
     'Skip the main steps: the ramp is about 20 m to the left, past the bike racks. The push button sits on the right-hand rail. Security will radio for Elevator A if you show your elevator pass at the desk.',
     now() - interval '33 days'),
    (pg_temp.demo_place(2), pg_temp.demo_user(11),
     '[{"id": "elevator", "label": "Elevator", "icon": "elevator"},
       {"id": "sensory-support", "label": "Sensory support", "icon": "quiet"}]',
     '[{"id": "elevator", "label": "Elevator", "icon": "elevator"},
       {"id": "sensory-support", "label": "Sensory support", "icon": "quiet"},
       {"id": "wheelchair-seating", "label": "Wheelchair seating", "icon": "seating"}]',
     'Take Elevator B to 3, turn right. The two tables nearest the windows are height-adjustable. The back study room is the quietest spot in the building during lunch.',
     'Take Elevator B to 3, turn right. The two tables nearest the windows are height-adjustable. The back study room is the quietest spot in the building during lunch.',
     now() - interval '9 days');

-- ---------------------------------------------------------------------------
-- 3. Reviews (place ratings and quiet scores follow by trigger)
-- ---------------------------------------------------------------------------

insert into public.reviews (place_id, user_id, rating, quiet_score, quiet_measured, accessibility_notes, created_at, updated_at)
select pg_temp.demo_place(place_n), pg_temp.demo_user(user_n), rating, quiet, measured, notes,
       now() - ago, now() - ago
from (values
    ( 1,  1, 4, 55,   false, 'Ramp is fine but the push button failed twice this month. When it works, it is the easiest way in.', interval '38 days'),
    ( 1, 11, 4, 50,   true,  'Gentle ramp, wide door. Morning rush is crowded so leave a few extra minutes.',                      interval '10 days'),
    ( 1,  5, 5, null, false, 'On crutches for six weeks and this entrance saved me every day.',                                       interval '29 days'),
    ( 1,  8, 3, 45,   false, 'Works, but the bike racks narrow the path to the ramp.',                                               interval '20 days'),
    ( 2,  3, 5, 88,   true,  'Measured it at lunch: by far the quietest room I have found in the building.',                         interval '35 days'),
    ( 2,  7, 4, 82,   false, 'Good lighting and large-print signs on the shelves. Catalogue computers have zoom.',                    interval '23 days'),
    ( 2, 11, 5, 85,   true,  'Adjustable tables by the windows actually fit my chair.',                                               interval '9 days'),
    ( 3,  4, 3, 18,   true,  'Ramp in, plenty of space between tables, but painfully loud during 5th period.',                        interval '34 days'),
    ( 3,  3, 2, 12,   true,  'Over the limit for me. I eat in the library now.',                                                       interval '25 days'),
    ( 3,  6, 3, 22,   false, 'Lines are wide enough for a wheelchair, but the tray rail is high.',                                     interval '17 days'),
    ( 4,  9, 4, 62,   false, 'Assistive listening headsets worked well at the fall concert.',                                         interval '27 days'),
    ( 4,  1, 4, 60,   false, 'Finally has marked wheelchair spaces with a seat for a friend next to them.',                           interval '11 days'),
    ( 5,  6, 2, 30,   true,  'There is an elevator, but nothing tells you where it is. Took me ten minutes the first time.',           interval '29 days'),
    ( 5, 10, 3, 35,   false, 'Bleachers have no accessible seating area yet.',                                                         interval '14 days'),
    ( 6,  5, 4, 72,   true,  'Beautiful and calm in the mornings. Some paths are steep, so use the DeKalb side.',                      interval '31 days'),
    ( 6,  2, 4, 68,   false, 'Accessible restroom by the tennis courts was open and clean.',                                           interval '19 days'),
    ( 7,  7, 5, 84,   true,  'Staff offered a magnifier without me asking. Step-free entrance and a quiet corner upstairs.',            interval '25 days'),
    ( 7,  3, 5, 80,   false, 'Great after-school study spot with a sensory-friendly hour on Thursdays.',                              interval '13 days'),
    ( 8,  2, 3, 24,   true,  'Elevators exist but one was out twice last week. Check before you leave.',                              interval '37 days'),
    ( 8,  1, 3, 20,   false, 'When the plaza elevator is up this station is great. When it is down there is no backup nearby.',         interval '15 days'),
    ( 8,  8, 4, 28,   false, 'Braille signs at every platform entrance.',                                                              interval '6 days'),
    ( 9,  8, 5, 15,   true,  'Loud during games (obviously), but sensory bags and quiet room are a big help.',                         interval '21 days'),
    ( 9, 11, 5, 20,   false, 'Accessible seats with a real view, not stuck in a corner.',                                             interval '4 days'),
    (10,  9, 5, 58,   false, 'Hearing loop works in the orchestra section. Staff knew exactly what I needed.',                         interval '15 days'),
    (10,  4, 4, 55,   false, 'Ramp entrance is on the side. Ask an usher if you cannot see the sign.',                                interval '8 days')
) as r (place_n, user_n, rating, quiet, measured, notes, ago);

-- ---------------------------------------------------------------------------
-- 4. Step-free directions and ramp measurements
-- ---------------------------------------------------------------------------

insert into public.place_directions (place_id, user_id, title, steps, created_at, updated_at)
values
    (pg_temp.demo_place(1), pg_temp.demo_user(1), 'From the street to the main lobby',
     '[{"text": "From Fort Greene Pl, pass the main steps and keep left along the building."},
       {"text": "After the bike racks, the ramp starts on your left. The push button is on the right-hand rail at the top."},
       {"text": "Inside, the security desk is straight ahead. Elevator A is behind it to the right."}]',
     now() - interval '33 days', now() - interval '33 days'),
    (pg_temp.demo_place(5), pg_temp.demo_user(6), 'Step-free route to the gym',
     '[{"text": "From the main lobby, take Elevator A down to the basement (B)."},
       {"text": "Turn left out of the elevator and follow the hallway past the weight room."},
       {"text": "The gym doors are at the end of the hall. The left door has the push button."}]',
     now() - interval '28 days', now() - interval '28 days'),
    (pg_temp.demo_place(8), pg_temp.demo_user(2), 'Street to the 2/3 platform without stairs',
     '[{"text": "Use the elevator on the Barclays Center plaza, at the corner of Atlantic and Flatbush."},
       {"text": "At mezzanine level, follow the blue accessible-route signs toward the 2/3."},
       {"text": "Take the second elevator down. Manhattan-bound trains board on the near side."}]',
     now() - interval '14 days', now() - interval '14 days');

insert into public.ramp_measurements (place_id, user_id, slope_percent, created_at)
select pg_temp.demo_place(place_n), pg_temp.demo_user(user_n), slope, now() - ago
from (values
    ( 1,  1,  7.9, interval '30 days'),
    ( 1,  5,  8.2, interval '27 days'),
    ( 1,  8,  7.6, interval '18 days'),
    ( 1, 11,  8.0, interval '9 days'),
    ( 6,  5, 10.4, interval '31 days'),
    ( 6,  2,  9.8, interval '19 days'),
    ( 6, 10, 10.1, interval '7 days'),
    (10,  4,  6.9, interval '8 days')
) as m (place_n, user_n, slope, ago);

-- ---------------------------------------------------------------------------
-- 5. Reports
--
-- Inserted with their final status: `resolved_at` and the staff note are only
-- trigger-maintained on update, so a backdated insert keeps the history true.
-- ---------------------------------------------------------------------------

create temp table demo_report_seed (
    n           integer,
    title       text,
    location    text,
    latitude    double precision,
    longitude   double precision,
    status      text,
    author_n    integer,
    created_ago interval,
    fixed_ago   interval,
    backers     integer,
    staff_note  text
) on commit drop;

insert into demo_report_seed values
    ( 1, 'Elevator B stuck between floors 4 and 8', 'Elevator B, south stairwell side', 40.68902, -73.97668,
      'resolved',     1, '34 days 5 hours', '29 days 2 hours', 10,
      'Contractor replaced the door sensor. Elevator B is back in service as of Monday morning.'),
    ( 2, 'Curb cut blocked by delivery trucks every morning', 'DeKalb Ave & Fort Greene Pl', 40.68975, -73.97598,
      'open',         2, '31 days 3 hours', null, 7, null),
    ( 3, 'Accessible restroom on the 2nd floor is always locked', '2nd floor, near room 2W', 40.68884, -73.97705,
      'resolved',     5, '27 days 6 hours', '20 days 4 hours', 9,
      'Custodial staff now keep it unlocked during school hours. A key is also at the main office.'),
    ( 4, 'Cafeteria too loud at lunch, with no quiet seating', 'Main cafeteria', 40.68868, -73.97702,
      'in-progress',  3, '24 days 2 hours', null, 10,
      'We are piloting a quiet table area by the east windows starting next week.'),
    ( 5, 'Auditorium has no marked wheelchair spaces', 'Auditorium, orchestra level', 40.68932, -73.97722,
      'resolved',    11, '22 days 7 hours', '12 days 3 hours', 6,
      'Four wheelchair spaces are now marked in row K, each with a companion seat.'),
    ( 6, 'Push button on the library door does nothing', 'Library entrance, 3rd floor', 40.68917, -73.97676,
      'resolved',     7, '19 days 4 hours', '15 days 6 hours', 5,
      'Facilities replaced the door actuator. Please report it again if it fails.'),
    ( 7, 'Only stairs are signed on the way to the gym', 'Gym, basement level', 40.68856, -73.97645,
      'in-progress',  6, '16 days 1 hour', null, 8,
      'New wayfinding signs for the elevator route are ordered and will be up within two weeks.'),
    ( 8, 'Water fountain too high to reach from a wheelchair', '4th floor, by the science labs', 40.68910, -73.97640,
      'open',         1, '13 days 5 hours', null, 4, null),
    ( 9, 'No visual fire alarm strobe in room 6E', 'Room 6E', 40.68922, -73.97695,
      'resolved',     9, '11 days 2 hours', '6 days 5 hours', 3,
      'Strobe installed and tested with the fire safety team.'),
    (10, 'Cracked sidewalk at the Ashland Pl entrance catches wheels', 'Ashland Pl side entrance', 40.68890, -73.97785,
      'open',         4, '8 days 3 hours', null, 6, null),
    (11, 'Flickering hallway lights on the 7th floor (migraine trigger)', '7th floor main hallway', 40.68895, -73.97660,
      'resolved',     3, '6 days 6 hours', '2 days 1 hour', 5,
      'All fixtures on the 7th floor east hallway replaced with steady LED panels.'),
    (12, 'Main office counter is too high to talk to staff', 'Main office, 1st floor', 40.68900, -73.97630,
      'open',        10, '4 days 4 hours', null, 3, null),
    (13, 'Classroom doors on the 5th floor too heavy to open alone', '5th floor, north wing', 40.68935, -73.97655,
      'open',         5, '2 days 2 hours', null, 2, null),
    (14, 'Elevator A out of service again', 'Elevator A, main lobby', 40.68893, -73.97625,
      'open',         8, '5 hours', null, 5, null);

insert into public.reports (
    id, title, location, latitude, longitude, status, created_by, created_at,
    resolved_at, staff_note, staff_updated_by, staff_updated_at
)
select pg_temp.demo_report(n), title, location, latitude, longitude, status,
       pg_temp.demo_user(author_n), now() - created_ago,
       now() - fixed_ago,
       coalesce(staff_note, ''),
       case when staff_note is not null then pg_temp.demo_user(12) end,
       case when staff_note is not null then now() - coalesce(fixed_ago, created_ago - interval '3 days') end
from demo_report_seed;

-- Backers: a stable pseudo-random pick of students other than the author,
-- each backing a few hours after the last.
insert into public.report_upvotes (report_id, user_id, created_at)
select pg_temp.demo_report(s.n), pg_temp.demo_user(b.n),
       least(now() - s.created_ago + b.rank * interval '6 hours', now() - interval '20 minutes')
from demo_report_seed s
cross join lateral (
    select n, row_number() over (order by md5(n::text || s.n::text)) as rank
    from generate_series(1, 11) as n
    where n <> s.author_n
    order by md5(n::text || s.n::text)
    limit s.backers
) b;

insert into public.report_comments (report_id, user_id, body, created_at)
select pg_temp.demo_report(report_n), pg_temp.demo_user(user_n), body, now() - ago
from (values
    ( 1,  6, 'Same here. I had to wait 20 minutes for Elevator A instead and missed the start of the test.', interval '34 days'),
    ( 1, 11, 'This is my only way up to 8th period. Thanks for reporting.',                             interval '33 days 18 hours'),
    ( 1, 12, 'Thanks all. The elevator company is booked for Thursday morning.',                         interval '32 days 2 hours'),
    ( 1,  1, 'Working again! Took the elevator to 6 today with no problems.',                            interval '29 days'),
    ( 2,  1, 'Had to go into the street to get around a truck today. Not safe.',                          interval '30 days 20 hours'),
    ( 2,  4, 'Worst between 7:30 and 8:15.',                                                              interval '28 days'),
    ( 3,  1, 'Asked security and they did not have the key either.',                                     interval '27 days'),
    ( 3, 12, 'Looking into this with the custodial team.',                                               interval '25 days'),
    ( 4,  6, 'I go to the library at lunch just to get away from the noise.',                             interval '23 days 20 hours'),
    ( 4, 11, 'A quiet table would really help. Even one corner would make a difference.',                 interval '22 days'),
    ( 4,  3, 'QuietScore measured 12 here at 12:40. That is the lowest of any room I have checked.',       interval '21 days'),
    ( 5,  1, 'My friends had to sit three rows away from me at the assembly.',                            interval '22 days'),
    ( 5, 12, 'Thank you for flagging this. Facilities will mark row K this week.',                        interval '18 days'),
    ( 7,  1, 'Took me ten minutes to find the elevator to the gym on the first day.',                     interval '15 days 20 hours'),
    ( 7, 10, 'Step-free directions on the Gym page helped me.',                                           interval '12 days'),
    ( 8, 11, 'Same on the 6th floor.',                                                                    interval '12 days'),
    (10,  1, 'My front caster got stuck here this morning.',                                              interval '7 days 20 hours'),
    (10,  2, 'Saw someone trip on it too.',                                                               interval '6 days'),
    (11,  9, 'Thank you! This was giving me headaches every afternoon.',                                  interval '1 day 20 hours'),
    (13,  5, 'With crutches I have to wait for someone to hold the door.',                                interval '1 day 22 hours'),
    (14,  1, 'Out again this morning. Security sent me to Elevator B.',                                    interval '4 hours'),
    (14,  4, 'Still out at 11.',                                                                          interval '2 hours')
) as c (report_n, user_n, body, ago);

-- ---------------------------------------------------------------------------
-- 6. Proposals and votes
-- ---------------------------------------------------------------------------

create temp table demo_poll_seed (
    n           integer,
    title       text,
    location    text,
    latitude    double precision,
    longitude   double precision,
    author_n    integer,
    created_ago interval,
    closes_in   interval,
    votes       integer
) on commit drop;

insert into demo_poll_seed values
    (1, 'Add automatic door openers to every 5th-floor classroom', '5th floor, north wing', 40.68935, -73.97655,
     5, '9 days', '12 days', 9),
    (2, 'Make one cafeteria section a quiet zone every day',          'Main cafeteria',         40.68868, -73.97702,
     3, '14 days', '7 days', 11),
    (3, 'Put Braille room numbers on every floor',                    'All floors',             40.68900, -73.97670,
     7, '6 days', '18 days', 7),
    (4, 'Hold Elevator B for elevator-pass holders between periods',  'Elevator B',             40.68902, -73.97668,
     1, '3 days', '25 days', 6);

insert into public.polls (id, title, location, latitude, longitude, closes_at, created_by, created_at)
select pg_temp.demo_poll(n), title, location, latitude, longitude, now() + closes_in,
       pg_temp.demo_user(author_n), now() - created_ago
from demo_poll_seed;

insert into public.poll_votes (poll_id, user_id, created_at)
select pg_temp.demo_poll(s.n), pg_temp.demo_user(v.n),
       least(now() - s.created_ago + v.rank * interval '9 hours', now() - interval '30 minutes')
from demo_poll_seed s
cross join lateral (
    select n, row_number() over (order by md5(n::text || 'poll' || s.n::text)) as rank
    from generate_series(1, 11) as n
    order by md5(n::text || 'poll' || s.n::text)
    limit s.votes
) v;

-- ---------------------------------------------------------------------------
-- 7. Presenter (optional)
--
-- Gives your own account a history: two reports you filed, people backing and
-- commenting on them, a staff fix, and backing for three demo reports.
-- ---------------------------------------------------------------------------

do $$
declare
    presenter_email constant text := '';  -- <- the email you sign in with
    me uuid;
begin
    if presenter_email = '' then
        raise notice 'presenter_email is empty: skipping your own account.';
        return;
    end if;

    select id into me from auth.users where lower(email) = lower(presenter_email);
    if me is null then
        raise notice 'No account for %: skipping your own account.', presenter_email;
        return;
    end if;

    insert into public.reports (
        id, title, location, latitude, longitude, status, created_by, created_at,
        resolved_at, staff_note, staff_updated_by, staff_updated_at
    )
    values
        (pg_temp.demo_report(101), 'Stairwell handrail loose on the 3rd floor', 'South stairwell, 3rd floor',
         40.68880, -73.97660, 'resolved', me, now() - interval '17 days',
         now() - interval '13 days', 'Handrail re-anchored and checked on every floor of the south stairwell.',
         pg_temp.demo_user(12), now() - interval '13 days'),
        (pg_temp.demo_report(102), 'No ramp to the 1st-floor science lab, only two steps', 'Room 1S, science wing',
         40.68875, -73.97685, 'open', me, now() - interval '3 days',
         null, '', null, null);

    insert into public.report_upvotes (report_id, user_id, created_at)
    select pg_temp.demo_report(101), pg_temp.demo_user(n), now() - interval '16 days' + n * interval '3 hours'
    from unnest(array[1, 3, 5, 8]) as n
    union all
    select pg_temp.demo_report(102), pg_temp.demo_user(n), now() - interval '3 days' + n * interval '2 hours'
    from unnest(array[1, 2, 4, 6, 9, 11]) as n;

    insert into public.report_comments (report_id, user_id, body, created_at)
    values
        (pg_temp.demo_report(101), pg_temp.demo_user(5),  'I nearly lost my balance on it with crutches.',                       now() - interval '16 days'),
        (pg_temp.demo_report(101), pg_temp.demo_user(12), 'Facilities will fix it this week. Thanks for the report.',             now() - interval '15 days'),
        (pg_temp.demo_report(102), pg_temp.demo_user(1),  'I have to wait in the hall for lab days. A portable ramp would work.', now() - interval '2 days 18 hours'),
        (pg_temp.demo_report(102), pg_temp.demo_user(12), 'Measuring the doorway this week to order a ramp.',                     now() - interval '6 hours');

    insert into public.report_upvotes (report_id, user_id, created_at)
    values
        (pg_temp.demo_report(2),  me, now() - interval '29 days'),
        (pg_temp.demo_report(4),  me, now() - interval '20 days'),
        (pg_temp.demo_report(14), me, now() - interval '3 hours')
    on conflict do nothing;

    insert into public.activity (user_id, kind, title, subtitle, occurred_at, report_id)
    values (me, 'status', 'Stairwell handrail loose on the 3rd floor is now resolved', 'South stairwell, 3rd floor',
            now() - interval '13 days', pg_temp.demo_report(101));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Backdate trigger-written activity
--
-- The review, vote and comment triggers stamp activity with `now()`. Move each
-- row to the moment the thing it describes happened.
-- ---------------------------------------------------------------------------

update public.activity a
set occurred_at = r.created_at
from public.reviews r
join public.places p on p.id = r.place_id
where a.occurred_at = now() and a.kind = 'review'
  and a.user_id = r.user_id and a.subtitle = p.name;

update public.activity a
set occurred_at = v.created_at
from public.poll_votes v
join public.polls p on p.id = v.poll_id
where a.occurred_at = now() and a.kind = 'vote'
  and a.user_id = v.user_id and a.title = 'You voted on ' || p.title;

update public.activity a
set occurred_at = c.created_at
from public.report_comments c
where a.occurred_at = now() and a.kind = 'comment'
  and a.report_id = c.report_id and a.subtitle = left(c.body, 140);

commit;
