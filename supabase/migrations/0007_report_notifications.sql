-- In-app notifications for report follow-up.
--
-- The activity feed only ever recorded what you did yourself, so the bell's
-- "unread" count was just the length of your own history. This adds the two
-- events someone actually needs to hear about:
--
--   * someone commented on a report you filed;
--   * a report you filed or marked yourself affected by changed status.
--
-- Both are written by triggers into `activity`, gated by the existing
-- `notifications_enabled` / `report_updates_enabled` settings, which until now
-- were stored but read by nothing. `activity_seen_at` records when the user
-- last opened their feed, so unread is a server-side fact that follows them
-- across devices.
--
-- Safe to re-run.

set search_path = public, extensions;

alter table public.activity
    add column if not exists report_id uuid references public.reports (id) on delete cascade;

alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
    check (kind in ('report', 'review', 'vote', 'comment', 'status'));

alter table public.user_settings
    add column if not exists activity_seen_at timestamptz not null default now();

-- Settings are written column by column. `user_id` is listed because the
-- client upserts, and an upsert rewrites its key; RLS still pins it to the
-- caller.
revoke update on public.user_settings from authenticated;
grant update (
    user_id, notifications_enabled, report_updates_enabled, vote_reminders_enabled,
    campus_name, activity_seen_at
) on public.user_settings to authenticated;

-- Link the author's own "You reported …" entry to the report, so the feed can
-- open it.
create or replace function public.log_report_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.created_by is null then
        return null;
    end if;

    insert into public.activity (user_id, kind, title, subtitle, occurred_at, report_id)
    values (new.created_by, 'report', 'You reported ' || new.title, new.location, new.created_at, new.id);

    return null;
end;
$$;

-- Who wants report updates: everyone whose settings allow them.
create or replace function public.wants_report_updates(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select notifications_enabled and report_updates_enabled
         from public.user_settings where user_id = target),
        true
    );
$$;

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
       or not public.wants_report_updates(report_author) then
        return null;
    end if;

    select coalesce(nullif(display_name, ''), 'Someone') into commenter
    from public.profiles where id = new.user_id;

    insert into public.activity (user_id, kind, title, subtitle, report_id)
    values (
        report_author,
        'comment',
        coalesce(commenter, 'Someone') || ' commented on ' || report_title,
        left(new.body, 140),
        new.report_id
    );

    return null;
end;
$$;

drop trigger if exists report_comments_notify on public.report_comments;
create trigger report_comments_notify
    after insert on public.report_comments
    for each row execute function public.notify_report_comment();

create or replace function public.notify_report_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    label text := case new.status
        when 'open' then 'reopened'
        when 'in-progress' then 'in progress'
        else 'resolved'
    end;
begin
    insert into public.activity (user_id, kind, title, subtitle, report_id)
    select recipient, 'status', new.title || ' is now ' || label, new.location, new.id
    from (
        select new.created_by as recipient
        union
        select u.user_id from public.report_upvotes u where u.report_id = new.id
    ) people
    where recipient is not null
      and recipient is distinct from auth.uid()
      and public.wants_report_updates(recipient);

    return null;
end;
$$;

drop trigger if exists reports_notify_status on public.reports;
create trigger reports_notify_status
    after update of status on public.reports
    for each row
    when (old.status is distinct from new.status)
    execute function public.notify_report_status();
