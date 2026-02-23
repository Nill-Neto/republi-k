-- Personal expenses (private to each user)
create table if not exists public.personal_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'pix', 'debit', 'credit_card')),
  purchase_date date not null,
  credit_card_id uuid null references public.credit_cards(id) on delete set null,
  installments int not null default 1 check (installments >= 1 and installments <= 36),
  created_at timestamptz not null default now()
);

alter table public.personal_expenses enable row level security;

create policy "personal_expenses_select_own"
on public.personal_expenses
for select
to authenticated
using (auth.uid() = user_id);

create policy "personal_expenses_insert_own"
on public.personal_expenses
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "personal_expenses_update_own"
on public.personal_expenses
for update
to authenticated
using (auth.uid() = user_id);

create policy "personal_expenses_delete_own"
on public.personal_expenses
for delete
to authenticated
using (auth.uid() = user_id);

-- Installments (one row per installment / bill)
create table if not exists public.personal_expense_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  personal_expense_id uuid not null references public.personal_expenses(id) on delete cascade,
  installment_number int not null check (installment_number >= 1),
  amount numeric not null check (amount >= 0),
  bill_month int not null check (bill_month >= 1 and bill_month <= 12),
  bill_year int not null check (bill_year >= 2000 and bill_year <= 2100),
  created_at timestamptz not null default now()
);

create index if not exists personal_expense_installments_user_id_idx
on public.personal_expense_installments(user_id);

create index if not exists personal_expense_installments_bill_idx
on public.personal_expense_installments(user_id, bill_year, bill_month);

alter table public.personal_expense_installments enable row level security;

create policy "personal_expense_installments_select_own"
on public.personal_expense_installments
for select
to authenticated
using (auth.uid() = user_id);

create policy "personal_expense_installments_insert_own"
on public.personal_expense_installments
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "personal_expense_installments_update_own"
on public.personal_expense_installments
for update
to authenticated
using (auth.uid() = user_id);

create policy "personal_expense_installments_delete_own"
on public.personal_expense_installments
for delete
to authenticated
using (auth.uid() = user_id);