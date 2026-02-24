-- Force update of the function to ensure strictly collective expenses are calculated
CREATE OR REPLACE FUNCTION public.get_member_balances(_group_id uuid)
 RETURNS TABLE(user_id uuid, total_owed numeric, total_paid numeric, balance numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    es.user_id,
    -- Total Owed: Sum ONLY splits from COLLECTIVE expenses
    coalesce(sum(es.amount), 0) as total_owed,
    
    -- Total Paid: Sum ONLY PAID splits from COLLECTIVE expenses
    coalesce(sum(CASE WHEN es.status = 'paid' THEN es.amount ELSE 0 END), 0) as total_paid,
    
    -- Balance = Total Paid - Total Owed (Negative means they owe money to the group)
    coalesce(sum(CASE WHEN es.status = 'paid' THEN es.amount ELSE 0 END), 0) -
    coalesce(sum(es.amount), 0) as balance
  FROM public.expense_splits es
  JOIN public.expenses e ON e.id = es.expense_id
  WHERE e.group_id = _group_id
    AND e.expense_type = 'collective' -- CRITICAL FILTER
    AND is_member_of_group(auth.uid(), _group_id)
  GROUP BY es.user_id;
$function$;