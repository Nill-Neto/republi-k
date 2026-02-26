alter view public.group_member_profiles set (security_invoker = true);

create or replace function public.get_group_member_public_profiles(_group_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  group_id uuid,
  active boolean,
  split_percentage numeric
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    p.id,
    p.full_name,
    p.avatar_url,
    gm.group_id,
    gm.active,
    gm.split_percentage
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = _group_id
    and gm.active = true
    and public.is_member_of_group(auth.uid(), _group_id);
$function$;

revoke all on function public.get_group_member_public_profiles(uuid) from public;
grant execute on function public.get_group_member_public_profiles(uuid) to authenticated;