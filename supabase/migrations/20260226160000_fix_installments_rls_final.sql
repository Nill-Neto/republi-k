-- Habilitar RLS na tabela de parcelas (caso não esteja)
ALTER TABLE public.expense_installments ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas que possam estar limitando o acesso
DROP POLICY IF EXISTS "Group members can view installments" ON public.expense_installments;
DROP POLICY IF EXISTS "expense_installments_select_own" ON public.expense_installments;
DROP POLICY IF EXISTS "view_installments_for_group_members" ON public.expense_installments;

-- Criar política permissiva para visualização
-- Permite ver a parcela se o usuário faz parte do grupo da despesa pai
CREATE POLICY "view_installments_members"
ON public.expense_installments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.expenses e 
    JOIN public.group_members gm ON e.group_id = gm.group_id
    WHERE e.id = expense_installments.expense_id
    AND gm.user_id = auth.uid()
    AND gm.active = true
  )
);

-- Garantir que o dono também possa ver (redundante mas seguro, caso não seja membro ativo por algum erro)
CREATE POLICY "view_installments_owner"
ON public.expense_installments
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Políticas para Inserir/Editar/Deletar (apenas o dono)
CREATE POLICY "manage_own_installments"
ON public.expense_installments
FOR ALL
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);