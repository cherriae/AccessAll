-- Let people delete their own account.
--
-- Deleting the `auth.users` row cascades to the profile, settings, reviews,
-- comments, votes and activity. Reports and places they created stay, with
-- `created_by` set to null: a barrier other people upvoted is still real after
-- its reporter leaves.
--
-- `security definer` because clients cannot touch `auth.users`; the function
-- deletes exactly one row, the caller's, and nothing else.
--
-- Safe to re-run.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Not signed in' using errcode = 'insufficient_privilege';
    end if;

    delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
