CREATE TABLE IF NOT EXISTS public.expense_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  bill_month INTEGER NOT NULL CHECK (bill_month BETWEEN 1 AND 12),
  bill_year INTEGER NOT NULL CHECK (bill_year BETWEEN 2000 AND 2100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expense_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_installments_select_own"
  ON public.expense_installments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "expense_installments_insert_own"
  ON public.expense_installments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expense_installments_update_own"
  ON public.expense_installments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "expense_installments_delete_own"
  ON public.expense_installments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
