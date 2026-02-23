
-- =============================================
-- PHASE 2: Expenses, Payments, Splits, Recurring
-- =============================================

-- 1. Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'other',
  expense_type text NOT NULL DEFAULT 'collective' CHECK (expense_type IN ('collective', 'individual')),
  due_date date,
  paid_to_provider boolean NOT NULL DEFAULT false,
  receipt_url text,
  recurring_expense_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Members can view group expenses
CREATE POLICY "Members can view group expenses"
  ON public.expenses FOR SELECT
  USING (is_member_of_group(auth.uid(), group_id));

-- RLS: Admin can create expenses
CREATE POLICY "Admin can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (has_role_in_group(auth.uid(), group_id, 'admin'));

-- RLS: Admin can update expenses
CREATE POLICY "Admin can update expenses"
  ON public.expenses FOR UPDATE
  USING (has_role_in_group(auth.uid(), group_id, 'admin'));

-- RLS: Admin can delete expenses
CREATE POLICY "Admin can delete expenses"
  ON public.expenses FOR DELETE
  USING (has_role_in_group(auth.uid(), group_id, 'admin'));

-- 2. Expense splits table
CREATE TABLE public.expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_id, user_id)
);

ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view splits for expenses in their group
CREATE POLICY "Members can view expense splits"
  ON public.expense_splits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_id AND is_member_of_group(auth.uid(), e.group_id)
  ));

-- RLS: Admin can manage splits
CREATE POLICY "Admin can create expense splits"
  ON public.expense_splits FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_id AND has_role_in_group(auth.uid(), e.group_id, 'admin')
  ));

CREATE POLICY "Admin can update expense splits"
  ON public.expense_splits FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_id AND has_role_in_group(auth.uid(), e.group_id, 'admin')
  ));

CREATE POLICY "Admin can delete expense splits"
  ON public.expense_splits FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_id AND has_role_in_group(auth.uid(), e.group_id, 'admin')
  ));

-- 3. Payments table (member payments to admin with receipts)
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  expense_split_id uuid REFERENCES public.expense_splits(id) ON DELETE SET NULL,
  paid_by uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  receipt_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view group payments
CREATE POLICY "Members can view group payments"
  ON public.payments FOR SELECT
  USING (is_member_of_group(auth.uid(), group_id));

-- RLS: Members can create their own payments
CREATE POLICY "Members can create own payments"
  ON public.payments FOR INSERT
  WITH CHECK (is_member_of_group(auth.uid(), group_id) AND paid_by = auth.uid());

-- RLS: Admin can update payments (confirm/reject)
CREATE POLICY "Admin can update payments"
  ON public.payments FOR UPDATE
  USING (has_role_in_group(auth.uid(), group_id, 'admin'));

-- RLS: Admin can delete payments
CREATE POLICY "Admin can delete payments"
  ON public.payments FOR DELETE
  USING (has_role_in_group(auth.uid(), group_id, 'admin'));

-- 4. Recurring expenses table
CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'other',
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 31),
  active boolean NOT NULL DEFAULT true,
  next_due_date date NOT NULL,
  last_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
CREATE POLICY "Members can view recurring expenses"
  ON public.recurring_expenses FOR SELECT
  USING (is_member_of_group(auth.uid(), group_id));

CREATE POLICY "Admin can create recurring expenses"
  ON public.recurring_expenses FOR INSERT
  WITH CHECK (has_role_in_group(auth.uid(), group_id, 'admin'));

CREATE POLICY "Admin can update recurring expenses"
  ON public.recurring_expenses FOR UPDATE
  USING (has_role_in_group(auth.uid(), group_id, 'admin'));

CREATE POLICY "Admin can delete recurring expenses"
  ON public.recurring_expenses FOR DELETE
  USING (has_role_in_group(auth.uid(), group_id, 'admin'));

-- 5. Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Storage policies: members can upload their own receipts
CREATE POLICY "Members can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Members can view group receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

CREATE POLICY "Members can update own receipts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admin can delete receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts');

-- 6. RPC: Create expense with automatic splits
CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
  _group_id uuid,
  _title text,
  _description text DEFAULT NULL,
  _amount numeric DEFAULT 0,
  _category text DEFAULT 'other',
  _expense_type text DEFAULT 'collective',
  _due_date date DEFAULT NULL,
  _receipt_url text DEFAULT NULL,
  _recurring_expense_id uuid DEFAULT NULL,
  _target_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _expense_id uuid;
  _caller_id uuid := auth.uid();
  _member record;
  _member_count int;
  _split_amount numeric(12,2);
  _group_rule text;
BEGIN
  -- Auth check
  IF NOT has_role_in_group(_caller_id, _group_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can create expenses';
  END IF;

  -- Input validation
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF length(_title) > 200 THEN
    RAISE EXCEPTION 'Title too long';
  END IF;

  -- Create expense
  INSERT INTO public.expenses (group_id, created_by, title, description, amount, category, expense_type, due_date, receipt_url, recurring_expense_id)
  VALUES (_group_id, _caller_id, _title, _description, _amount, _category, _expense_type, _due_date, _receipt_url, _recurring_expense_id)
  RETURNING id INTO _expense_id;

  -- Create splits
  IF _expense_type = 'individual' AND _target_user_id IS NOT NULL THEN
    -- Individual expense: assign to specific user
    INSERT INTO expense_splits (expense_id, user_id, amount)
    VALUES (_expense_id, _target_user_id, _amount);
  ELSE
    -- Collective expense: split among active members
    SELECT splitting_rule::text INTO _group_rule FROM public.groups WHERE id = _group_id;

    IF _group_rule = 'equal' THEN
      SELECT count(*) INTO _member_count
      FROM public.group_members WHERE group_id = _group_id AND active = true;

      _split_amount := round(_amount / _member_count, 2);

      FOR _member IN
        SELECT user_id FROM public.group_members WHERE group_id = _group_id AND active = true
      LOOP
        INSERT INTO expense_splits (expense_id, user_id, amount)
        VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    ELSE
      -- Percentage-based split
      FOR _member IN
        SELECT user_id, coalesce(split_percentage, 0) as pct
        FROM public.group_members WHERE group_id = _group_id AND active = true
      LOOP
        _split_amount := round(_amount * _member.pct / 100, 2);
        INSERT INTO expense_splits (expense_id, user_id, amount)
        VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    END IF;
  END IF;

  -- Audit log
  PERFORM create_audit_log(_group_id, _caller_id, 'create', 'expense', _expense_id,
    jsonb_build_object('title', _title, 'amount', _amount, 'type', _expense_type));

  RETURN _expense_id;
END;
$$;

-- 7. RPC: Confirm payment (admin only)
CREATE OR REPLACE FUNCTION public.confirm_payment(
  _payment_id uuid,
  _status text DEFAULT 'confirmed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _payment record;
  _caller_id uuid := auth.uid();
BEGIN
  SELECT * INTO _payment FROM public.payments WHERE id = _payment_id;

  IF _payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF NOT has_role_in_group(_caller_id, _payment.group_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can confirm payments';
  END IF;

  IF _status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.payments
  SET status = _status, confirmed_by = _caller_id, confirmed_at = now()
  WHERE id = _payment_id;

  -- If confirmed, update split status
  IF _status = 'confirmed' AND _payment.expense_split_id IS NOT NULL THEN
    UPDATE public.expense_splits
    SET status = 'paid', paid_at = now()
    WHERE id = _payment.expense_split_id;
  END IF;

  -- Notify payer
  PERFORM create_notification(
    _payment.paid_by, _payment.group_id,
    CASE WHEN _status = 'confirmed' THEN 'Pagamento confirmado' ELSE 'Pagamento recusado' END,
    CASE WHEN _status = 'confirmed' THEN 'Seu pagamento de R$ ' || _payment.amount || ' foi confirmado.'
         ELSE 'Seu pagamento de R$ ' || _payment.amount || ' foi recusado.' END,
    'payment_' || _status,
    jsonb_build_object('payment_id', _payment_id::text, 'amount', _payment.amount)
  );

  -- Audit
  PERFORM create_audit_log(_payment.group_id, _caller_id, _status, 'payment', _payment_id,
    jsonb_build_object('amount', _payment.amount, 'paid_by', _payment.paid_by::text));
END;
$$;

-- 8. View: Consolidated balance per member
CREATE OR REPLACE FUNCTION public.get_member_balances(_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  total_owed numeric,
  total_paid numeric,
  balance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    es.user_id,
    coalesce(sum(es.amount), 0) as total_owed,
    coalesce(sum(CASE WHEN es.status = 'paid' THEN es.amount ELSE 0 END), 0) as total_paid,
    coalesce(sum(CASE WHEN es.status = 'paid' THEN es.amount ELSE 0 END), 0) -
    coalesce(sum(es.amount), 0) as balance
  FROM public.expense_splits es
  JOIN public.expenses e ON e.id = es.expense_id
  WHERE e.group_id = _group_id
    AND is_member_of_group(auth.uid(), _group_id)
  GROUP BY es.user_id;
$$;

-- Indexes for performance
CREATE INDEX idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX idx_expenses_created_at ON public.expenses(created_at DESC);
CREATE INDEX idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON public.expense_splits(user_id);
CREATE INDEX idx_expense_splits_status ON public.expense_splits(status);
CREATE INDEX idx_payments_group_id ON public.payments(group_id);
CREATE INDEX idx_payments_paid_by ON public.payments(paid_by);
CREATE INDEX idx_recurring_expenses_group_id ON public.recurring_expenses(group_id);
CREATE INDEX idx_recurring_expenses_next_due ON public.recurring_expenses(next_due_date) WHERE active = true;
