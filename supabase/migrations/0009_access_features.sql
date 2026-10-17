-- Data for the features that set AccessAll apart:
--
--   1. Access profile — each person's access needs, so places are scored for
--      *them* rather than against a generic wheelchair checklist.
--   2. School staff — a role that can move any report forward and attach a
--      note and photo as proof of the fix, closing the report → fix loop.
--   3. Impact — `resolved_at` plus a summary view, so progress is measurable.
--   4. Measured quiet scores — a review can record that its quiet score came
--      from the phone's microphone rather than an impression.
--   5. Step-free directions — community-written, step-by-step routes through a
--      place, each step optionally with a photo.
--   6. Photo storage for 2 and 5.
--
-- Safe to re-run.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Access profile
--
-- Private like the rest of `user_settings`. Values are fixed so the client's
-- scoring and the stored choice cannot drift apart.
-- ---------------------------------------------------------------------------

alter table public.user_settings
    add column if not exists access_needs text[] not null default '{}';

alter table public.user_settings drop constraint if exists user_settings_access_needs_known;
alter table public.user_settings add constraint user_settings_access_needs_known
    check (access_needs <@ array['wheelchair', 'temporary-injury', 'low-vision', 'deaf', 'sensory']::text[]);

grant update (access_needs) on public.user_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. School staff
--
-- Membership is granted by a project admin in the SQL editor, never by the
-- client:
--
--     insert into public.staff_members (user_id, title)
--     values ('<auth user id>', 'Assistant Principal');
--
-- Who is staff is public: a "resolved by staff" badge has to be checkable.
-- ---------------------------------------------------------------------------

create table if not exists public.staff_members (
    user_id  uuid primary key references public.profiles (id) on delete cascade,
    title    text not null default '' check (length(title) <= 80),
    added_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;

drop policy if exists staff_members_select on public.staff_members;
create policy staff_members_select on public.staff_members
    for select using (true);

revoke insert, update, delete on public.staff_members from anon, authenticated;

create or replace function public.is_staff(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.staff_members where user_id = uid);
$$;

grant execute on function public.is_staff(uuid) to anon, authenticated;

alter table public.reports
    add column if not exists resolved_at      timestamptz,
    add column if not exists staff_note       text not null default '',
    add column if not exists staff_photo_path text not null default '',
    add column if not exists staff_updated_by uuid references public.profiles (id) on delete set null,
    add column if not exists staff_updated_at timestamptz;

-- `resolved_at` follows the status no matter who changes it, so "days to
-- resolve" cannot be set by hand.
create or replace function public.track_report_resolution()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'resolved' and old.status is distinct from 'resolved' then
        new.resolved_at := now();
    elsif new.status <> 'resolved' then
        new.resolved_at := null;
    end if;

    return new;
end;
$$;

drop trigger if exists reports_track_resolution on public.reports;
create trigger reports_track_resolution
    before update of status on public.reports
    for each row execute function public.track_report_resolution();

-- Staff act through this function rather than an RLS policy, because a staff
-- update writes columns (the note, photo and who/when) that no ordinary client
-- may write.
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

    -- A photo must be one the caller uploaded (see the storage policies below).
    if photo_path <> '' and photo_path not like auth.uid()::text || '/%' then
        raise exception 'Photo must be your own upload' using errcode = 'check_violation';
    end if;

    update public.reports
    set status           = new_status,
        staff_note       = btrim(note),
        staff_photo_path = photo_path,
        staff_updated_by = auth.uid(),
        staff_updated_at = now()
    where id = report_id;

    if not found then
        raise exception 'Report not found' using errcode = 'no_data_found';
    end if;
end;
$$;

revoke execute on function public.staff_update_report(uuid, text, text, text) from public, anon;
grant execute on function public.staff_update_report(uuid, text, text, text) to authenticated;

-- Staff updates are the moment a student most wants to hear about, so tell
-- the reporter even when only the note changed.
create or replace function public.notify_staff_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.created_by is null
       or new.created_by = new.staff_updated_by
       or new.status is distinct from old.status  -- `notify_report_status` covers it
       or not public.wants_report_updates(new.created_by) then
        return null;
    end if;

    insert into public.activity (user_id, kind, title, subtitle, report_id)
    values (new.created_by, 'status', 'School staff updated ' || new.title, left(new.staff_note, 140), new.id);

    return null;
end;
$$;

drop trigger if exists reports_notify_staff_note on public.reports;
create trigger reports_notify_staff_note
    after update of staff_note on public.reports
    for each row
    when (old.staff_note is distinct from new.staff_note)
    execute function public.notify_staff_note();

-- ---------------------------------------------------------------------------
-- 4. Measured quiet scores (column first: `impact_summary` below counts it)
-- ---------------------------------------------------------------------------

alter table public.reviews
    add column if not exists quiet_measured boolean not null default false;

-- A measurement without a score is meaningless.
alter table public.reviews drop constraint if exists reviews_measured_has_score;
alter table public.reviews add constraint reviews_measured_has_score
    check (not quiet_measured or quiet_score is not null);

grant insert (quiet_measured), update (quiet_measured) on public.reviews to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Impact
-- ---------------------------------------------------------------------------

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
     ) contributors)                                                    as contributors;

grant select on public.impact_summary to anon, authenticated;

create or replace view public.review_feed
with (security_invoker = true) as
select r.id,
       r.place_id,
       r.user_id,
       r.rating,
       r.quiet_score,
       r.accessibility_notes,
       r.created_at,
       coalesce(nullif(p.display_name, ''), 'Community member') as author_name,
       r.updated_at,
       r.quiet_measured
from public.reviews r
join public.profiles p on p.id = r.user_id;

-- ---------------------------------------------------------------------------
-- 5. Step-free directions
-- ---------------------------------------------------------------------------

-- 1–30 steps, each `{ "text": string, "photo"?: string }`, where a photo is a
-- path inside the author's own storage folder.
create or replace function public.is_valid_direction_steps(candidate jsonb, author uuid)
returns boolean
language sql
immutable
as $$
    select case
        when jsonb_typeof(candidate) <> 'array' then false
        when jsonb_array_length(candidate) not between 1 and 30 then false
        else not exists (
            select 1
            from jsonb_array_elements(candidate) as elements(step)
            where jsonb_typeof(step) <> 'object'
               or jsonb_typeof(step -> 'text') is distinct from 'string'
               or btrim(step ->> 'text') = ''
               or length(step ->> 'text') > 500
               or (step ? 'photo' and (
                      jsonb_typeof(step -> 'photo') <> 'string'
                      or (step ->> 'photo') not like author::text || '/%'
                  ))
        )
    end;
$$;

create table if not exists public.place_directions (
    id         uuid primary key default gen_random_uuid(),
    place_id   uuid not null references public.places (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,
    title      text not null check (btrim(title) <> '' and length(title) <= 120),
    steps      jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint place_directions_steps_valid check (public.is_valid_direction_steps(steps, user_id))
);

create index if not exists place_directions_place_idx on public.place_directions (place_id, created_at);

alter table public.place_directions enable row level security;

drop policy if exists place_directions_select on public.place_directions;
create policy place_directions_select on public.place_directions
    for select using (true);

drop policy if exists place_directions_insert_own on public.place_directions;
create policy place_directions_insert_own on public.place_directions
    for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists place_directions_update_own on public.place_directions;
create policy place_directions_update_own on public.place_directions
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists place_directions_delete_own on public.place_directions;
create policy place_directions_delete_own on public.place_directions
    for delete to authenticated using (auth.uid() = user_id);

revoke insert, update on public.place_directions from anon, authenticated;
grant insert (id, place_id, user_id, title, steps) on public.place_directions to authenticated;
grant update (title, steps) on public.place_directions to authenticated;

drop trigger if exists place_directions_touch_updated_at on public.place_directions;
create trigger place_directions_touch_updated_at
    before update on public.place_directions
    for each row execute function public.touch_updated_at();

create or replace view public.direction_feed
with (security_invoker = true) as
select d.id,
       d.place_id,
       d.user_id,
       d.title,
       d.steps,
       d.updated_at,
       coalesce(nullif(p.display_name, ''), 'Community member') as author_name
from public.place_directions d
join public.profiles p on p.id = d.user_id;

grant select on public.direction_feed to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Photo storage
--
-- Public read (the photos illustrate public reports and directions), write
-- only into your own `<user id>/` folder, 5 MB images only.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists photos_insert_own on storage.objects;
create policy photos_insert_own on storage.objects
    for insert to authenticated
    with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists photos_delete_own on storage.objects;
create policy photos_delete_own on storage.objects
    for delete to authenticated
    using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Home screen card
-- ---------------------------------------------------------------------------

insert into public.app_features (id, title, description, action, route, icon, accent, sort_index)
values ('impact', 'Impact', 'See what the community reported, who it affects, and what got fixed.', 'View impact', '/impact', 'activity', 'success', 3)
on conflict (id) do update
set title       = excluded.title,
    description = excluded.description,
    action      = excluded.action,
    route       = excluded.route,
    icon        = excluded.icon,
    accent      = excluded.accent,
    sort_index  = excluded.sort_index;
