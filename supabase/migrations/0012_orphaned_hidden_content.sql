-- can_see treated "author is not distinct from auth.uid()" as ownership, which is
-- also true when both are null: a signed-out visitor could see hidden content
-- whose author had deleted their account (created_by / user_id set null).
-- Ownership now requires a signed-in caller.

create or replace function public.can_see(author uuid, hidden timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        (auth.uid() is not null and author = auth.uid())
        or public.is_staff()
        or (
            hidden is null
            and not exists (
                select 1 from public.user_blocks b
                where b.blocker_id = auth.uid() and b.blocked_id = author
            )
        );
$$;
