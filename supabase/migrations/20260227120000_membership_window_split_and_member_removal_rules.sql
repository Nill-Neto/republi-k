-- Regras de rateio por janela de participação + exclusão segura de morador

-- 1) Atualiza a criação de despesas para considerar janela de participação
--    (joined_at / left_at) na data de compra da despesa.
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
  _closing_day int;
  _per_installment numeric(12,2);
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

    -- Membros elegíveis: estavam no grupo na data de compra da despesa
    IF _group_rule = 'equal' THEN
      SELECT count(*) INTO _member_count
      FROM public.group_members gm
      WHERE gm.group_id = _group_id
        AND gm.joined_at::date <= _final_purchase_date
        AND (gm.left_at IS NULL OR gm.left_at::date >= _final_purchase_date);

      IF _member_count <= 0 THEN
        RAISE EXCEPTION 'No eligible group members for expense date %', _final_purchase_date;
      END IF;

      _split_amount := round(_amount / _member_count, 2);

      FOR _member IN
        SELECT gm.user_id
        FROM public.group_members gm
        WHERE gm.group_id = _group_id
          AND gm.joined_at::date <= _final_purchase_date
          AND (gm.left_at IS NULL OR gm.left_at::date >= _final_purchase_date)
      LOOP
        INSERT INTO expense_splits (expense_id, user_id, amount)
        VALUES (_expense_id, _member.user_id, _split_amount);
      END LOOP;
    ELSE
      FOR _member IN
        SELECT gm.user_id, COALESCE(gm.split_percentage, 0) AS pct
        FROM public.group_members gm
        WHERE gm.group_id = _group_id
          AND gm.joined_at::date <= _final_purchase_date
          AND (gm.left_at IS NULL OR gm.left_at::date >= _final_purchase_date)
      LOOP
        _split_amount := round(_amount * _member.pct / 100, 2);
        INSERT INTO expense_splits (expense_id, user_id, amount)
        VALUES (_expense_id, _member.user_id, _split_amount);
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

-- 2) Exclusão de morador com regra de segurança e trilha de auditoria.
--    Não deleta histórico: marca saída (left_at) e inativa o vínculo.
CREATE OR REPLACE FUNCTION public.remove_group_member(
  _group_id uuid,
  _target_user_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor_id uuid := auth.uid();
  _target_role public.app_role;
  _active_admin_count int;
BEGIN
  IF NOT public.has_role_in_group(_actor_id, _group_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can remove members';
  END IF;

  IF _actor_id = _target_user_id THEN
    RAISE EXCEPTION 'Use leave flow to remove yourself';
  END IF;

  SELECT ur.role
  INTO _target_role
  FROM public.user_roles ur
  WHERE ur.group_id = _group_id
    AND ur.user_id = _target_user_id;

  IF _target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not in this group';
  END IF;

  -- Evita remover o último admin ativo do grupo.
  IF _target_role = 'admin' THEN
    SELECT count(*) INTO _active_admin_count
    FROM public.user_roles ur
    JOIN public.group_members gm
      ON gm.group_id = ur.group_id
     AND gm.user_id = ur.user_id
    WHERE ur.group_id = _group_id
      AND ur.role = 'admin'
      AND gm.active = true;

    IF _active_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last active admin of the group';
    END IF;
  END IF;

  UPDATE public.group_members gm
  SET
    active = false,
    left_at = COALESCE(gm.left_at, now())
  WHERE gm.group_id = _group_id
    AND gm.user_id = _target_user_id
    AND gm.active = true;

  DELETE FROM public.user_roles ur
  WHERE ur.group_id = _group_id
    AND ur.user_id = _target_user_id;

  PERFORM public.create_audit_log(
    _group_id,
    _actor_id,
    'remove_member',
    'group_member',
    _target_user_id,
    jsonb_build_object('reason', _reason)
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_group_member(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid, text) TO authenticated;
