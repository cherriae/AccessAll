-- Moderation, blocking and place edit history.
--
--   1. Anyone can report a report, comment, review or set of directions as
--      abusive. Three different people reporting the same item hides it
--      straight away, before staff have looked: on an app used by minors,
--      harassment should not stay up overnight waiting for a human.
--   2. Staff work a moderation queue: hide the item or dismiss the report.
--   3. Blocking someone hides their content from you and stops their comments
--      notifying you.
--   4. Every change to a place's access features or guide is logged, and staff
--      can roll a change back. A fake "elevator" is a safety problem for a
--      wheelchair user, so vandalism has to be both visible and reversible.
--
-- Safe to re-run.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Hidden content
-- ---------------------------------------------------------------------------

alter table public.reports          add column if not exists hidden_at timestamptz;
alter table public.report_comments  add column if not exists hidden_at timestamptz;
alter table public.reviews          add column if not exists hidden_at timestamptz;
alter table public.place_directions add column if not exists hidden_at timestamptz;

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

create table if not exists public.user_blocks (
    blocker_id uuid not null references public.profiles (id) on delete cascade,
    blocked_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (blocker_id, blocked_id),
    check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
    for select to authenticated using (auth.uid() = blocker_id);

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks
    for insert to authenticated with check (auth.uid() = blocker_id);

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks
    for delete to authenticated using (auth.uid() = blocker_id);

revoke insert, update on public.user_blocks from anon, authenticated;
grant insert (blocker_id, blocked_id) on public.user_blocks to authenticated;

-- True when the signed-in user should see content by `author`: it is not
-- hidden by moderation (unless it is their own, or they are staff) and they
-- have not blocked its author.
create or replace function public.can_see(author uuid, hidden timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        author is not distinct from auth.uid()
        or public.is_staff()
        or (
            hidden is null
            and not exists (
                select 1 from public.user_blocks b
                where b.blocker_id = auth.uid() and b.blocked_id = author
            )
        );
$$;

grant execute on function public.can_see(uuid, timestamptz) to anon, authenticated;

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
    for select using (public.can_see(created_by, hidden_at));

drop policy if exists report_comments_select on public.report_comments;
create policy report_comments_select on public.report_comments
    for select using (public.can_see(user_id, hidden_at));

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
    for select using (public.can_see(user_id, hidden_at));

drop policy if exists place_directions_select on public.place_directions;
create policy place_directions_select on public.place_directions
    for select using (public.can_see(user_id, hidden_at));

-- A hidden review must stop counting toward the place's rating.
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
        where place_id = target and hidden_at is null
    ) s
    where p.id = target;

    return null;
end;
$$;

-- Comments from someone you blocked do not notify you.
create or replace function public.notify_report_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    report_title  text;
    report_author uuid;
    commenter     text;
begin
    select title, created_by into report_title, report_author
    from public.reports where id = new.report_id;

    if report_author is null
       or report_author = new.user_id
       or not public.wants_report_updates(report_author)
       or exists (select 1 from public.user_blocks where blocker_id = report_author and blocked_id = new.user_id) then
        return null;
    end if;

    select coalesce(nullif(public_name, ''), 'Someone') into commenter
    from public.profiles where id = new.user_id;

    insert into public.activity (user_id, kind, title, subtitle, report_id)
    values (report_author, 'comment', coalesce(commenter, 'Someone') || ' commented on ' || report_title,
            left(new.body, 140), new.report_id);

    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Content reports
-- ---------------------------------------------------------------------------

create table if not exists public.content_reports (
    id          uuid primary key default gen_random_uuid(),
    reporter_id uuid not null references public.profiles (id) on delete cascade,
    target_type text not null check (target_type in ('report', 'comment', 'review', 'direction')),
    target_id   uuid not null,
    reason      text not null check (reason in ('harassment', 'spam', 'false-info', 'inappropriate', 'other')),
    details     text not null default '' check (length(details) <= 500),
    status      text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
    created_at  timestamptz not null default now(),
    unique (reporter_id, target_type, target_id)
);

create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);
create index if not exists content_reports_open_idx on public.content_reports (created_at) where status = 'open';

alter table public.content_reports enable row level security;

drop policy if exists content_reports_select on public.content_reports;
create policy content_reports_select on public.content_reports
    for select to authenticated using (auth.uid() = reporter_id or public.is_staff());

drop policy if exists content_reports_insert_own on public.content_reports;
create policy content_reports_insert_own on public.content_reports
    for insert to authenticated with check (auth.uid() = reporter_id);

revoke insert, update, delete on public.content_reports from anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on public.content_reports to authenticated;

drop trigger if exists content_reports_rate_limit on public.content_reports;
create trigger content_reports_rate_limit before insert on public.content_reports
    for each row execute function public.enforce_rate_limit('reporter_id', '20', '1 hour');

-- Sets (or clears) `hidden_at` on whatever a content report points at.
create or replace function public.set_content_hidden(kind text, target uuid, hide boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    stamp timestamptz := case when hide then now() else null end;
begin
    case kind
        when 'report'    then update public.reports          set hidden_at = stamp where id = target;
        when 'comment'   then update public.report_comments  set hidden_at = stamp where id = target;
        when 'review'    then update public.reviews          set hidden_at = stamp where id = target;
        when 'direction' then update public.place_directions set hidden_at = stamp where id = target;
    end case;
end;
$$;

revoke execute on function public.set_content_hidden(text, uuid, boolean) from public, anon, authenticated;

-- Three distinct people reporting one item hides it pending staff review.
create or replace function public.auto_hide_reported()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (select count(distinct reporter_id) from public.content_reports
        where target_type = new.target_type and target_id = new.target_id and status = 'open') >= 3 then
        perform public.set_content_hidden(new.target_type, new.target_id, true);
    end if;

    return null;
end;
$$;

drop trigger if exists content_reports_auto_hide on public.content_reports;
create trigger content_reports_auto_hide
    after insert on public.content_reports
    for each row execute function public.auto_hide_reported();

-- Staff decision on every open report about one item: hide it, or dismiss
-- the reports and make it visible again.
create or replace function public.moderate_content(kind text, target uuid, decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_staff() then
        raise exception 'Only school staff can do this' using errcode = 'insufficient_privilege';
    end if;

    if decision not in ('hide', 'dismiss') then
        raise exception 'Unknown decision' using errcode = 'check_violation';
    end if;

    perform public.set_content_hidden(kind, target, decision = 'hide');

    update public.content_reports
    set status = case when decision = 'hide' then 'actioned' else 'dismissed' end
    where target_type = kind and target_id = target and status = 'open';
end;
$$;

revoke execute on function public.moderate_content(text, uuid, text) from public, anon;
grant execute on function public.moderate_content(text, uuid, text) to authenticated;

-- What staff see: one row per reported item, with its text and report count.
create or replace view public.moderation_queue
with (security_invoker = true) as
select r.target_type,
       r.target_id,
       count(*)                                   as report_count,
       array_agg(distinct r.reason)               as reasons,
       min(r.created_at)                          as first_reported_at,
       coalesce(
           (select title from public.reports where r.target_type = 'report' and id = r.target_id),
           (select body from public.report_comments where r.target_type = 'comment' and id = r.target_id),
           (select accessibility_notes from public.reviews where r.target_type = 'review' and id = r.target_id),
           (select title from public.place_directions where r.target_type = 'direction' and id = r.target_id),
           '(deleted)'
       )                                          as content,
       coalesce(
           (select hidden_at from public.reports where r.target_type = 'report' and id = r.target_id),
           (select hidden_at from public.report_comments where r.target_type = 'comment' and id = r.target_id),
           (select hidden_at from public.reviews where r.target_type = 'review' and id = r.target_id),
           (select hidden_at from public.place_directions where r.target_type = 'direction' and id = r.target_id)
       ) is not null                              as is_hidden
from public.content_reports r
where r.status = 'open'
group by r.target_type, r.target_id;

grant select on public.moderation_queue to authenticated;

-- ---------------------------------------------------------------------------
-- Place edit history
-- ---------------------------------------------------------------------------

create table if not exists public.place_edits (
    id           uuid primary key default gen_random_uuid(),
    place_id     uuid not null references public.places (id) on delete cascade,
    editor_id    uuid references public.profiles (id) on delete set null,
    old_features jsonb not null,
    new_features jsonb not null,
    old_guide    text not null,
    new_guide    text not null,
    created_at   timestamptz not null default now(),
    reverted_at  timestamptz,
    reverted_by  uuid references public.profiles (id) on delete set null
);

create index if not exists place_edits_place_idx on public.place_edits (place_id, created_at desc);
create index if not exists place_edits_editor_idx on public.place_edits (editor_id, created_at);

alter table public.place_edits enable row level security;

-- History is public: anyone deciding whether to trust a place's details can
-- see who changed them and when.
drop policy if exists place_edits_select on public.place_edits;
create policy place_edits_select on public.place_edits for select using (true);

revoke insert, update, delete on public.place_edits from anon, authenticated;

create or replace function public.log_place_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.features is distinct from old.features or new.community_guide is distinct from old.community_guide then
        insert into public.place_edits (place_id, editor_id, old_features, new_features, old_guide, new_guide)
        values (new.id, auth.uid(), old.features, new.features, old.community_guide, new.community_guide);
    end if;

    return null;
end;
$$;

drop trigger if exists places_log_edit on public.places;
create trigger places_log_edit
    after update of features, community_guide on public.places
    for each row execute function public.log_place_edit();

-- Editing places is the cheapest way to vandalise; limit it like posting.
drop trigger if exists place_edits_rate_limit on public.place_edits;
create trigger place_edits_rate_limit before insert on public.place_edits
    for each row execute function public.enforce_rate_limit('editor_id', '20', '1 hour');

create or replace view public.place_edit_feed
with (security_invoker = true) as
select e.id,
       e.place_id,
       e.old_features,
       e.new_features,
       e.old_guide,
       e.new_guide,
       e.created_at,
       e.reverted_at,
       coalesce(nullif(p.public_name, ''), 'Community member') as editor_name
from public.place_edits e
left join public.profiles p on p.id = e.editor_id;

grant select on public.place_edit_feed to anon, authenticated;

-- Staff roll a place back to how it was before an edit. The rollback is
-- itself an edit, so it shows in the history too.
create or replace function public.revert_place_edit(edit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    edit public.place_edits;
begin
    if not public.is_staff() then
        raise exception 'Only school staff can do this' using errcode = 'insufficient_privilege';
    end if;

    select * into edit from public.place_edits where id = edit_id;
    if not found then
        raise exception 'Edit not found' using errcode = 'no_data_found';
    end if;

    update public.places
    set features = edit.old_features, community_guide = edit.old_guide
    where id = edit.place_id;

    update public.place_edits set reverted_at = now(), reverted_by = auth.uid() where id = edit_id;
end;
$$;

revoke execute on function public.revert_place_edit(uuid) from public, anon;
grant execute on function public.revert_place_edit(uuid) to authenticated;

-- The signed-in user's block list, with names, for Settings.
create or replace view public.my_blocks
with (security_invoker = true) as
select b.blocked_id,
       b.created_at,
       coalesce(nullif(p.public_name, ''), 'Community member') as blocked_name
from public.user_blocks b
left join public.profiles p on p.id = b.blocked_id
where b.blocker_id = auth.uid();

grant select on public.my_blocks to authenticated;
