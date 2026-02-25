
-- =============================================
-- FIX 1: Recreate recurring_expenses policies as PERMISSIVE
-- =============================================
DROP POLICY IF EXISTS "Create recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "View recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Update recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Delete recurring expenses" ON public.recurring_expenses;

CREATE POLICY "View recurring expenses"
ON public.recurring_expenses
FOR SELECT
TO authenticated
USING (
  is_member_of_group(auth.uid(), group_id)
  AND (
    expense_type = 'collective'
    OR created_by = auth.uid()
  )
);

CREATE POLICY "Create recurring expenses"
ON public.recurring_expenses
FOR INSERT
TO authenticated
WITH CHECK (
  is_member_of_group(auth.uid(), group_id)
  AND created_by = auth.uid()
  AND (
    (expense_type = 'collective' AND has_role_in_group(auth.uid(), group_id, 'admin'))
    OR expense_type = 'individual'
  )
);

CREATE POLICY "Update recurring expenses"
ON public.recurring_expenses
FOR UPDATE
TO authenticated
USING (
  is_member_of_group(auth.uid(), group_id)
  AND (
    (expense_type = 'collective' AND has_role_in_group(auth.uid(), group_id, 'admin'))
    OR (expense_type = 'individual' AND created_by = auth.uid())
  )
);

CREATE POLICY "Delete recurring expenses"
ON public.recurring_expenses
FOR DELETE
TO authenticated
USING (
  is_member_of_group(auth.uid(), group_id)
  AND (
    (expense_type = 'collective' AND has_role_in_group(auth.uid(), group_id, 'admin'))
    OR (expense_type = 'individual' AND created_by = auth.uid())
  )
);

-- =============================================
-- FIX 2: Fix expenses SELECT to scope visibility
-- Only show collective expenses + individual expenses where user is involved
-- =============================================
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
      WHERE es.expense_id = id AND es.user_id = auth.uid()
    )
  )
);
