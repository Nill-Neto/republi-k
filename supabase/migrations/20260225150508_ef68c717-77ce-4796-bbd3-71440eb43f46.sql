
DROP POLICY IF EXISTS "Members can view group expenses" ON public.expenses;

CREATE POLICY "Members can view group expenses"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  is_member_of_group(auth.uid(), group_id)
  AND (
    expense_type = 'collective'
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.expense_splits es
      WHERE es.expense_id = expenses.id AND es.user_id = auth.uid()
    )
  )
);
