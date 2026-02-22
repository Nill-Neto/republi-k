
-- =============================================
-- REPUBLI-K: Phase 1 Database Schema
-- =============================================

-- Enums
create type public.app_role as enum ('admin', 'morador');
create type public.splitting_rule as enum ('equal', 'percentage');
create type public.invite_status as enum ('pending', 'accepted', 'rejected', 'expired');

-- =============================================
-- TABLES
-- =============================================

-- User profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text default '',
  phone text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sensitive user data (CPF) - separate table for strict access control
create table public.profile_sensitive (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cpf text not null,
  created_at timestamptz not null default now()
);

-- Housing groups (moradias)
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  splitting_rule splitting_rule not null default 'equal',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Group members
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  split_percentage numeric(5,2) default 0,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  active boolean not null default true,
  unique(group_id, user_id)
);

-- User roles per group (separate table as required)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  role app_role not null default 'morador',
  created_at timestamptz not null default now(),
  unique(user_id, group_id)
);

-- Invites
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid(),
  status invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique(group_id, email)
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  read boolean not null default false,
  data jsonb,
  created_at timestamptz not null default now()
);

-- Audit log
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- =============================================
-- INDEXES
-- =============================================

create index idx_group_members_group on public.group_members(group_id);
create index idx_group_members_user on public.group_members(user_id);
create index idx_user_roles_user on public.user_roles(user_id);
create index idx_user_roles_group on public.user_roles(group_id);
create index idx_invites_email on public.invites(email);
create index idx_invites_token on public.invites(token);
create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_unread on public.notifications(user_id, read) where read = false;
create index idx_audit_log_group on public.audit_log(group_id);
create index idx_audit_log_created on public.audit_log(created_at);

-- =============================================
-- SECURITY DEFINER FUNCTIONS (avoid RLS recursion)
-- =============================================

-- Check if user has a specific role in a group
create or replace function public.has_role_in_group(_user_id uuid, _group_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and group_id = _group_id and role = _role
  )
$$;

-- Check if user is a member of a group
create or replace function public.is_member_of_group(_user_id uuid, _group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where user_id = _user_id and group_id = _group_id and active = true
  )
$$;

-- Get all group IDs for a user
create or replace function public.get_user_group_ids(_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select group_id from public.group_members
  where user_id = _user_id and active = true
$$;

-- Check if user is admin of any group the target user belongs to
create or replace function public.is_admin_of_user(_admin_id uuid, _target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.group_members gm on gm.group_id = ur.group_id and gm.active = true
    where ur.user_id = _admin_id
      and ur.role = 'admin'
      and gm.user_id = _target_user_id
  )
$$;

-- Create a notification (security definer to bypass RLS)
create or replace function public.create_notification(
  _user_id uuid,
  _group_id uuid,
  _title text,
  _message text,
  _type text,
  _data jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.notifications (user_id, group_id, title, message, type, data)
  values (_user_id, _group_id, _title, _message, _type, _data)
  returning id into _id;
  return _id;
end;
$$;

-- Create audit log entry (security definer to bypass RLS)
create or replace function public.create_audit_log(
  _group_id uuid,
  _user_id uuid,
  _action text,
  _entity_type text,
  _entity_id uuid default null,
  _details jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.audit_log (group_id, user_id, action, entity_type, entity_id, details)
  values (_group_id, _user_id, _action, _entity_type, _entity_id, _details)
  returning id into _id;
  return _id;
end;
$$;

-- Create group and assign creator as admin (atomic operation)
create or replace function public.create_group_with_admin(
  _name text,
  _description text default null,
  _splitting_rule splitting_rule default 'equal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _group_id uuid;
  _user_id uuid := auth.uid();
begin
  insert into public.groups (name, description, splitting_rule, created_by)
  values (_name, _description, _splitting_rule, _user_id)
  returning id into _group_id;

  insert into public.group_members (group_id, user_id)
  values (_group_id, _user_id);

  insert into public.user_roles (user_id, group_id, role)
  values (_user_id, _group_id, 'admin');

  perform public.create_audit_log(
    _group_id, _user_id, 'create', 'group', _group_id,
    jsonb_build_object('name', _name, 'splitting_rule', _splitting_rule::text)
  );

  return _group_id;
end;
$$;

-- Accept invite (atomic: update invite + add member + assign role + notify)
create or replace function public.accept_invite(_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _invite record;
  _user_id uuid := auth.uid();
  _user_email text;
begin
  select email into _user_email from auth.users where id = _user_id;

  select * into _invite from public.invites
  where token = _token and status = 'pending' and expires_at > now();

  if _invite is null then
    return jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  end if;

  if lower(_invite.email) != lower(_user_email) then
    return jsonb_build_object('success', false, 'error', 'Este convite não é para este email');
  end if;

  if public.is_member_of_group(_user_id, _invite.group_id) then
    return jsonb_build_object('success', false, 'error', 'Você já é membro deste grupo');
  end if;

  update public.invites set status = 'accepted' where id = _invite.id;

  insert into public.group_members (group_id, user_id)
  values (_invite.group_id, _user_id);

  insert into public.user_roles (user_id, group_id, role)
  values (_user_id, _invite.group_id, 'morador');

  perform public.create_notification(
    _invite.invited_by, _invite.group_id,
    'Convite aceito',
    coalesce(_user_email, 'Usuário') || ' aceitou o convite para o grupo',
    'invite_accepted',
    jsonb_build_object('user_id', _user_id::text, 'email', _user_email)
  );

  perform public.create_audit_log(
    _invite.group_id, _user_id, 'accept_invite', 'invite', _invite.id,
    jsonb_build_object('email', _user_email)
  );

  return jsonb_build_object('success', true, 'group_id', _invite.group_id);
end;
$$;

-- Updated at trigger function
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger update_groups_updated_at
  before update on public.groups
  for each row execute function public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

-- PROFILES
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "Users can view profiles in same group"
  on public.profiles for select to authenticated
  using (id in (
    select gm.user_id from public.group_members gm
    where gm.group_id in (select public.get_user_group_ids(auth.uid()))
    and gm.active = true
  ));

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid());

-- PROFILE_SENSITIVE (CPF)
alter table public.profile_sensitive enable row level security;

create policy "Users can view own sensitive data"
  on public.profile_sensitive for select to authenticated
  using (user_id = auth.uid());

create policy "Admin can view group members sensitive data"
  on public.profile_sensitive for select to authenticated
  using (public.is_admin_of_user(auth.uid(), user_id));

create policy "Users can insert own sensitive data"
  on public.profile_sensitive for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own sensitive data"
  on public.profile_sensitive for update to authenticated
  using (user_id = auth.uid());

-- GROUPS
alter table public.groups enable row level security;

create policy "Members can view their groups"
  on public.groups for select to authenticated
  using (id in (select public.get_user_group_ids(auth.uid())));

create policy "Authenticated users can create groups"
  on public.groups for insert to authenticated
  with check (created_by = auth.uid());

create policy "Admin can update group"
  on public.groups for update to authenticated
  using (public.has_role_in_group(auth.uid(), id, 'admin'));

create policy "Admin can delete group"
  on public.groups for delete to authenticated
  using (public.has_role_in_group(auth.uid(), id, 'admin'));

-- GROUP_MEMBERS
alter table public.group_members enable row level security;

create policy "Members can view group members"
  on public.group_members for select to authenticated
  using (public.is_member_of_group(auth.uid(), group_id));

create policy "Admin can manage group members"
  on public.group_members for insert to authenticated
  with check (public.has_role_in_group(auth.uid(), group_id, 'admin'));

create policy "Admin can update group members"
  on public.group_members for update to authenticated
  using (public.has_role_in_group(auth.uid(), group_id, 'admin'));

create policy "Admin can remove group members"
  on public.group_members for delete to authenticated
  using (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- USER_ROLES
alter table public.user_roles enable row level security;

create policy "Members can view roles in their groups"
  on public.user_roles for select to authenticated
  using (group_id in (select public.get_user_group_ids(auth.uid())));

create policy "Admin can manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- INVITES
alter table public.invites enable row level security;

create policy "Admin can view group invites"
  on public.invites for select to authenticated
  using (public.has_role_in_group(auth.uid(), group_id, 'admin'));

create policy "Invited users can view their invites"
  on public.invites for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy "Admin can create invites"
  on public.invites for insert to authenticated
  with check (public.has_role_in_group(auth.uid(), group_id, 'admin'));

create policy "Admin can update invites"
  on public.invites for update to authenticated
  using (public.has_role_in_group(auth.uid(), group_id, 'admin'));

create policy "Invited users can update own invite"
  on public.invites for update to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy "Admin can delete invites"
  on public.invites for delete to authenticated
  using (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- NOTIFICATIONS
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- AUDIT_LOG
alter table public.audit_log enable row level security;

create policy "Members can view group audit log"
  on public.audit_log for select to authenticated
  using (group_id in (select public.get_user_group_ids(auth.uid())));
