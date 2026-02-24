CREATE OR REPLACE FUNCTION public.get_member_balances(_group_id uuid)
 RETURNS TABLE(user_id uuid, total_owed numeric, total_paid numeric, balance numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH 
  -- 1. Funded: Quanto cada usuário pagou originalmente nas despesas (Crédito)
  funded AS (
    SELECT created_by as user_id, sum(amount) as amount
    FROM expenses 
    WHERE group_id = _group_id AND expense_type = 'collective'
    GROUP BY created_by
  ),
  -- 2. My Share: Qual a parte de cada usuário no rateio (Débito)
  my_share AS (
    SELECT es.user_id, sum(es.amount) as amount
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = _group_id AND e.expense_type = 'collective'
    GROUP BY es.user_id
  ),
  -- 3. Paid Back: Quanto o usuário já pagou de reembolso para o grupo/admin (Crédito)
  paid_back AS (
    SELECT es.user_id, sum(es.amount) as amount
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = _group_id AND e.expense_type = 'collective' AND es.status = 'paid'
    GROUP BY es.user_id
  ),
  -- 4. Received: Quanto o usuário (como pagador da despesa) já recebeu de reembolso (Débito no saldo a receber)
  received AS (
    SELECT e.created_by as user_id, sum(es.amount) as amount
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = _group_id AND e.expense_type = 'collective' AND es.status = 'paid'
    GROUP BY e.created_by
  )
  SELECT 
    gm.user_id,
    -- Total Owed (Visualização): Mantemos como 'Minha Parte' para referência
    coalesce(s.amount, 0) as total_owed,
    
    -- Total Paid (Visualização): Quanto já reembolsou
    coalesce(p.amount, 0) as total_paid,
    
    -- Balance Real: (Paguei na Loja) - (Minha Parte) + (Reembolsei Admin) - (Me Reembolsaram)
    (coalesce(f.amount, 0) - coalesce(s.amount, 0) + coalesce(p.amount, 0) - coalesce(r.amount, 0)) as balance
  FROM group_members gm
  LEFT JOIN funded f ON f.user_id = gm.user_id
  LEFT JOIN my_share s ON s.user_id = gm.user_id
  LEFT JOIN paid_back p ON p.user_id = gm.user_id
  LEFT JOIN received r ON r.user_id = gm.user_id
  WHERE gm.group_id = _group_id AND gm.active = true;
$function$;