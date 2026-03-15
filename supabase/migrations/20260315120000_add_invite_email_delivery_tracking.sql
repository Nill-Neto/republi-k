alter table public.invites
  add column if not exists email_delivery_status text not null default 'pending',
  add column if not exists email_error text,
  add column if not exists email_sent_at timestamptz;

alter table public.invites
  drop constraint if exists invites_email_delivery_status_check;

alter table public.invites
  add constraint invites_email_delivery_status_check
  check (email_delivery_status in ('pending', 'sent', 'failed'));
