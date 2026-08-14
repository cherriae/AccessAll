-- Read models for the screens.
--
-- The UI renders an author's *name*; the tables store an author's *id*. Rather
-- than make every client join profiles back in (and hand-maintain PostgREST
-- relationship metadata to do it), each list screen reads a view that has
-- already resolved the name.
--
-- All three are `security_invoker`, so the caller's row level security still
-- applies exactly as it would against the underlying tables.

set search_path = public, extensions;

create or replace view public.place_feed
with (security_invoker = true) as
select p.id,
       p.name,
       p.category,
       p.address,
       p.accessibility_note,
       p.source_label,
       p.source_url,
       p.community_guide,
       p.guide_updated_at,
       coalesce(nullif(author.display_name, ''), '') as guide_author,
       p.verified,
       p.latitude,
       p.longitude,
       p.features,
       p.rating,
       p.review_count,
       p.quiet_score,
       p.created_at
from public.places p
left join public.profiles author on author.id = p.guide_author_id;

create or replace view public.review_feed
with (security_invoker = true) as
select r.id,
       r.place_id,
       r.user_id,
       r.rating,
       r.quiet_score,
       r.accessibility_notes,
       r.created_at,
       coalesce(nullif(p.display_name, ''), 'Community member') as author_name
from public.reviews r
join public.profiles p on p.id = r.user_id;

create or replace view public.report_comment_feed
with (security_invoker = true) as
select c.id,
       c.report_id,
       c.user_id,
       c.body,
       c.created_at,
       coalesce(nullif(p.display_name, ''), 'Community member') as author_name
from public.report_comments c
join public.profiles p on p.id = c.user_id;

grant select on public.place_feed, public.review_feed, public.report_comment_feed to anon, authenticated;
