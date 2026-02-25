-- Remove a política antiga que permitia apenas ao dono ver as parcelas
DROP POLICY IF EXISTS "expense_installments_select_own" ON public.expense_installments;

-- Nova política: qualquer usuário com split na despesa (ou o criador original) pode visualizar as parcelas
CREATE POLICY "expense_installments_select_by_split"
ON public.expense_installments
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.expense_splits es
    WHERE es.expense_id = expense_installments.expense_id
      AND es.user_id = auth.uid()
  )
);