
-- Create a SECURITY DEFINER function to check splits without triggering RLS
CREATE OR REPLACE FUNCTION public.user_has_split_on_expense(_user_id uuid, _expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expense_splits
    WHERE expense_id = _expense_id AND user_id = _user_id
  );
$$;

-- Recreate expenses SELECT policy using the function
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
    OR user_has_split_on_expense(auth.uid(), id)
  )
);
