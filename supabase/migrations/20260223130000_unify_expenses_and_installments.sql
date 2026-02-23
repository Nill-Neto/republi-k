-- 1. Create a unified installments table linked to the main expenses
CREATE TABLE IF NOT EXISTS public.expense_installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  bill_month INTEGER NOT NULL,
  bill_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expense_installments ENABLE ROW LEVEL SECURITY;

-- Policies: users can see their own installments or admins can see group installments
CREATE POLICY "Users can view own installments" ON public.expense_installments
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view group installments" ON public.expense_installments
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.user_roles ur ON ur.group_id = e.group_id
    WHERE e.id = expense_installments.expense_id 
    AND ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  )
);

-- 2. Update the RPC function to handle installments automatically
CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
  _group_id uuid,
  _title text,
  _description text DEFAULT NULL::text,
  _amount numeric DEFAULT 0,
  _category text DEFAULT 'other'::text,
  _expense_type text DEFAULT 'collective'::text,
  _due_date date DEFAULT NULL::date,
  _receipt_url text DEFAULT NULL::text,
  _recurring_expense_id uuid DEFAULT NULL::uuid,
  _target_user_id uuid DEFAULT NULL::uuid,
  _payment_method text DEFAULT 'cash',
  _credit_card_id uuid DEFAULT NULL::uuid,
  _installments integer DEFAULT 1,
  _purchase_date date DEFAULT NULL::date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _expense_id uuid;
  _caller_id uuid := auth.uid();
  _member record;
  _member_count int;
  _split_amount numeric(12,2);
  _group_rule text;
  _final_purchase_date date;
  _per_installment numeric(12,2);
  _closing_day int;
  _bill_month int;
  _bill_year int;
  _bill_base date;
BEGIN
  _final_purchase_date := COALESCE(_purchase_date, CURRENT_DATE);

  IF NOT has_role_in_group(_caller_id, _group_id, 'admin') AND _expense_type = 'collective' THEN
    RAISE EXCEPTION 'Only admins can create collective expenses';
  END IF;

  INSERT INTO public.expenses (
    group_id, created_by, title, description, amount, category, 
    expense_type, due_date, receipt_url, recurring_expense_id,
    payment_method, credit_card_id, installments, purchase_date
  )
  VALUES (
    _group_id, _caller_id, _title, _description, _amount, _category, 
    _expense_type, _due_date, _receipt_url, _recurring_expense_id,
    _payment_method, _credit_card_id, _installments, _final_purchase_date
  )
  RETURNING id INTO _expense_id;

  -- Create Splits
  IF _expense_type = 'individual' THEN
    INSERT INTO expense_splits (expense_id, user_id, amount)
    VALUES (_expense_id, COALESCE(_target_user_id, _caller_id), _amount);
  ELSE
    SELECT splitting_rule::text INTO _group_rule FROM public.groups WHERE id = _group_id;
    IF _group_rule = 'equal' THEN
      SELECT count(*) INTO _member_count FROM public.group_members WHERE group_id = _group_id AND active = true;
      _split_amount := round(_amount / _member_count, 2);
      FOR _member IN SELECT user_id FROM public.group_members WHERE group_id = _group_id AND active = true LOOP
        INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    ELSE
      FOR _member IN SELECT user_id, coalesce(split_percentage, 0) as pct FROM public.group_members WHERE group_id = _group_id AND active = true LOOP
        _split_amount := round(_amount * _member.pct / 100, 2);
        INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    END IF;
  END IF;

  -- Create Installments if Credit Card
  IF _payment_method = 'credit_card' AND _credit_card_id IS NOT NULL AND _installments > 0 THEN
    SELECT closing_day INTO _closing_day FROM public.credit_cards WHERE id = _credit_card_id;
    
    _bill_base := _final_purchase_date;
    IF EXTRACT(DAY FROM _final_purchase_date) > _closing_day THEN
      _bill_base := _bill_base + interval '1 month';
    END IF;
    
    _per_installment := round(_amount / _installments, 2);

    FOR i IN 1.._installments LOOP
      _bill_month := EXTRACT(MONTH FROM _bill_base + ((i-1) * interval '1 month'));
      _bill_year := EXTRACT(YEAR FROM _bill_base + ((i-1) * interval '1 month'));
      
      INSERT INTO public.expense_installments (user_id, expense_id, installment_number, amount, bill_month, bill_year)
      VALUES (_caller_id, _expense_id, i, _per_installment, _bill_month, _bill_year);
    END LOOP;
  END IF;

  RETURN _expense_id;
END;
$function$;

-- Cleanup old tables
DROP TABLE IF EXISTS public.personal_expense_installments CASCADE;
DROP TABLE IF EXISTS public.personal_expenses CASCADE;