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
  _target_user_id uuid DEFAULT NULL::uuid
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
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_member_of_group(_caller_id, _group_id) THEN
    RAISE EXCEPTION 'Not authorized to create expenses for this group';
  END IF;

  IF _expense_type = 'collective' THEN
    IF NOT public.has_role_in_group(_caller_id, _group_id, 'admin') THEN
      RAISE EXCEPTION 'Only admins can create collective expenses';
    END IF;
  ELSE
    IF _target_user_id IS NULL THEN
      RAISE EXCEPTION 'Target user required for individual expenses';
    END IF;

    IF _target_user_id <> _caller_id THEN
      RAISE EXCEPTION 'Users can only create individual expenses for themselves';
    END IF;
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF length(_title) > 200 THEN
    RAISE EXCEPTION 'Title too long';
  END IF;

  INSERT INTO public.expenses (group_id, created_by, title, description, amount, category, expense_type, due_date, receipt_url, recurring_expense_id)
  VALUES (_group_id, _caller_id, _title, _description, _amount, _category, _expense_type, _due_date, _receipt_url, _recurring_expense_id)
  RETURNING id INTO _expense_id;

  IF _expense_type = 'individual' AND _target_user_id IS NOT NULL THEN
    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    VALUES (_expense_id, _target_user_id, _amount);
  ELSE
    SELECT splitting_rule::text INTO _group_rule FROM public.groups WHERE id = _group_id;

    IF _group_rule = 'equal' THEN
      SELECT count(*) INTO _member_count
      FROM public.group_members
      WHERE group_id = _group_id AND active = true;

      _split_amount := round(_amount / _member_count, 2);

      FOR _member IN
        SELECT user_id FROM public.group_members WHERE group_id = _group_id AND active = true
      LOOP
        INSERT INTO public.expense_splits (expense_id, user_id, amount)
        VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    ELSE
      FOR _member IN
        SELECT user_id, coalesce(split_percentage, 0) as pct
        FROM public.group_members
        WHERE group_id = _group_id AND active = true
      LOOP
        _split_amount := round(_amount * _member.pct / 100, 2);
        INSERT INTO public.expense_splits (expense_id, user_id, amount)
        VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    END IF;
  END IF;

  PERFORM public.create_audit_log(
    _group_id,
    _caller_id,
    'create',
    'expense',
    _expense_id,
    jsonb_build_object('title', _title, 'amount', _amount, 'type', _expense_type)
  );

  RETURN _expense_id;
END;
$function$;