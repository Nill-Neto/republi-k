create or replace view public.group_member_profiles
with (security_invoker=off) as
select
  p.id,
  p.full_name,
  p.avatar_url,
  gm.group_id,
  gm.active,
  gm.split_percentage
from public.profiles p
join public.group_members gm on gm.user_id = p.id
where gm.active = true
  and public.is_member_of_group(auth.uid(), gm.group_id);

alter view public.group_member_profiles set (security_invoker = false);

grant select on public.group_member_profiles to authenticated;