ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS instantallments integer GENERATED ALWAYS AS (installments) STORED;

COMMENT ON COLUMN public.expenses.instantallments IS 'Alias legado para installments (correção de grafia)';