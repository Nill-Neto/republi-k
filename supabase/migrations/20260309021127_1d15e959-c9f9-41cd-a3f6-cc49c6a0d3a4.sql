
-- Add participates_in_splits column to group_members
ALTER TABLE public.group_members
ADD COLUMN participates_in_splits boolean NOT NULL DEFAULT true;

-- Update create_expense_with_splits to exclude non-participating members
CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
  _group_id uuid, _title text, _description text DEFAULT NULL, _amount numeric DEFAULT 0,
  _category text DEFAULT 'other', _expense_type text DEFAULT 'collective',
  _due_date date DEFAULT NULL, _receipt_url text DEFAULT NULL,
  _recurring_expense_id uuid DEFAULT NULL, _target_user_id uuid DEFAULT NULL,
  _payment_method text DEFAULT 'cash', _credit_card_id uuid DEFAULT NULL,
  _installments integer DEFAULT 1, _purchase_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    RAISE EXCEPTION 'Apenas administradores podem criar despesas coletivas';
  END IF;

  INSERT INTO public.expenses (
    group_id, created_by, title, description, amount, category,
    expense_type, due_date, receipt_url, recurring_expense_id,
    payment_method, credit_card_id, installments, purchase_date
  ) VALUES (
    _group_id, _caller_id, _title, _description, _amount, _category,
    _expense_type, _due_date, _receipt_url, _recurring_expense_id,
    _payment_method, _credit_card_id, _installments, _final_purchase_date
  ) RETURNING id INTO _expense_id;

  IF _expense_type = 'individual' THEN
    INSERT INTO expense_splits (expense_id, user_id, amount)
    VALUES (_expense_id, COALESCE(_target_user_id, _caller_id), _amount);
  ELSE
    SELECT splitting_rule::text INTO _group_rule FROM public.groups WHERE id = _group_id;
    IF _group_rule = 'equal' THEN
      SELECT count(*) INTO _member_count FROM public.group_members
      WHERE group_id = _group_id AND active = true AND participates_in_splits = true;
      _split_amount := round(_amount / _member_count, 2);
      FOR _member IN SELECT user_id FROM public.group_members
        WHERE group_id = _group_id AND active = true AND participates_in_splits = true LOOP
        INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    ELSE
      FOR _member IN SELECT user_id, coalesce(split_percentage, 0) as pct FROM public.group_members
        WHERE group_id = _group_id AND active = true AND participates_in_splits = true LOOP
        _split_amount := round(_amount * _member.pct / 100, 2);
        INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    END IF;
  END IF;

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
$$;

-- Update get_member_balances to only include participating members
CREATE OR REPLACE FUNCTION public.get_member_balances(_group_id uuid)
RETURNS TABLE(user_id uuid, total_owed numeric, total_paid numeric, balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    es.user_id,
    coalesce(sum(es.amount), 0) as total_owed,
    coalesce(sum(CASE WHEN es.status = 'paid' THEN es.amount ELSE 0 END), 0) as total_paid,
    coalesce(sum(CASE WHEN es.status = 'paid' THEN es.amount ELSE 0 END), 0) -
    coalesce(sum(es.amount), 0) as balance
  FROM public.expense_splits es
  JOIN public.expenses e ON e.id = es.expense_id
  WHERE e.group_id = _group_id
    AND e.expense_type = 'collective'
    AND is_member_of_group(auth.uid(), _group_id)
  GROUP BY es.user_id;
$$;
