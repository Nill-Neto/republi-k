-- Permitir que membros do grupo visualizem as parcelas (expense_installments)
-- Se a despesa pai pertence a um grupo onde o usuário é membro, ele pode ver as parcelas.

DROP POLICY IF EXISTS "Group members can view installments" ON public.expense_installments;

CREATE POLICY "Group members can view installments"
ON public.expense_installments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_installments.expense_id
    AND public.is_member_of_group(auth.uid(), e.group_id)
  )
);