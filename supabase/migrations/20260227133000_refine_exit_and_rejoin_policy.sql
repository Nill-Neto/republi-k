-- Refina regras de saída/retorno conforme política de negócio:
-- - Data de saída é excludente para novos rateios no mesmo dia
-- - Morador pode sair devendo (período já utilizado permanece)
-- - Parte não utilizada (splits futuros pendentes) é redistribuída
-- - Retorno permitido somente sem débitos; mesma competência reativa vínculo, senão cria novo

-- 0) Permite múltiplos vínculos históricos por usuário/grupo.
ALTER TABLE public.group_members
  DROP CONSTRAINT IF EXISTS group_members_group_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_members_active_member
  ON public.group_members(group_id, user_id)
  WHERE active = true;

-- 1) Ajusta criação de split para considerar left_at como limite EXCLUDENTE no dia da saída.
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

  IF _expense_type = 'individual' THEN
    INSERT INTO expense_splits (expense_id, user_id, amount)
    VALUES (_expense_id, COALESCE(_target_user_id, _caller_id), _amount);
  ELSE
    SELECT splitting_rule::text INTO _group_rule FROM public.groups WHERE id = _group_id;

    IF _group_rule = 'equal' THEN
      SELECT count(*) INTO _member_count
      FROM public.group_members gm
      WHERE gm.group_id = _group_id
        AND gm.joined_at::date <= _final_purchase_date
        AND (gm.left_at IS NULL OR gm.left_at::date > _final_purchase_date);

      IF _member_count <= 0 THEN
        RAISE EXCEPTION 'No eligible group members for expense date %', _final_purchase_date;
      END IF;

      _split_amount := round(_amount / _member_count, 2);

      FOR _member IN
        SELECT gm.user_id
        FROM public.group_members gm
        WHERE gm.group_id = _group_id
          AND gm.joined_at::date <= _final_purchase_date
          AND (gm.left_at IS NULL OR gm.left_at::date > _final_purchase_date)
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
          AND (gm.left_at IS NULL OR gm.left_at::date > _final_purchase_date)
      LOOP
        _split_amount := round(_amount * _member.pct / 100, 2);
        INSERT INTO expense_splits (expense_id, user_id, amount)
        VALUES (_expense_id, _member.user_id, _split_amount);
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
$function$;

-- 2) Remove membro e redistribui apenas valores ainda NÃO utilizados (splits futuros pendentes).
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
  _effective_ts timestamptz := now();
  _effective_date date := now()::date;
  _group_rule text;
  _split record;
  _member record;
  _member_count int;
  _split_amount numeric(12,2);
  _total_pct numeric(12,2);
  _redistributed_count int := 0;
  _preserved_count int := 0;
  _target_balance numeric := 0;
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

  IF _target_role = 'admin' THEN
    SELECT count(*) INTO _active_admin_count
    FROM public.user_roles ur
    JOIN public.group_members gm
      ON gm.group_id = ur.group_id
     AND gm.user_id = ur.user_id
    WHERE ur.group_id = _group_id
      AND ur.role = 'admin'
      AND gm.active = true
      AND ur.user_id <> _target_user_id;

    IF _active_admin_count <= 0 THEN
      RAISE EXCEPTION 'Transfer admin role before removing this admin';
    END IF;
  END IF;

  -- Se o grupo deve dinheiro ao morador (saldo credor), exige acerto antes da saída.
  SELECT COALESCE(mb.balance, 0)
    INTO _target_balance
  FROM public.get_member_balances(_group_id) mb
  WHERE mb.user_id = _target_user_id;

  IF COALESCE(_target_balance, 0) > 0 THEN
    RAISE EXCEPTION 'Member has credit balance to receive; settle before removal';
  END IF;

  SELECT splitting_rule::text INTO _group_rule FROM public.groups WHERE id = _group_id;

  -- Preserva período utilizado (purchase_date < data de saída): não mexe nesses splits.
  SELECT count(*) INTO _preserved_count
  FROM public.expense_splits es
  JOIN public.expenses e ON e.id = es.expense_id
  WHERE es.user_id = _target_user_id
    AND es.status = 'pending'
    AND e.group_id = _group_id
    AND e.expense_type = 'collective'
    AND e.purchase_date < _effective_date;

  -- Redistribui apenas a parte não utilizada: splits pendentes a partir da data de saída
  -- sem pagamento pendente/confirmado associado.
  FOR _split IN
    SELECT es.id, es.expense_id, es.amount, e.purchase_date
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    WHERE es.user_id = _target_user_id
      AND es.status = 'pending'
      AND e.group_id = _group_id
      AND e.expense_type = 'collective'
      AND e.purchase_date >= _effective_date
      AND NOT EXISTS (
        SELECT 1
        FROM public.payments p
        WHERE p.expense_split_id = es.id
          AND p.status IN ('pending', 'confirmed')
      )
  LOOP
    DELETE FROM public.expense_splits WHERE id = _split.id;

    IF _group_rule = 'equal' THEN
      SELECT count(*) INTO _member_count
      FROM public.group_members gm
      WHERE gm.group_id = _group_id
        AND gm.user_id <> _target_user_id
        AND gm.active = true
        AND gm.joined_at::date <= _split.purchase_date
        AND (gm.left_at IS NULL OR gm.left_at::date > _split.purchase_date);

      IF _member_count <= 0 THEN
        RAISE EXCEPTION 'No eligible members to redistribute split %', _split.id;
      END IF;

      _split_amount := round(_split.amount / _member_count, 2);
      FOR _member IN
        SELECT gm.user_id
        FROM public.group_members gm
        WHERE gm.group_id = _group_id
          AND gm.user_id <> _target_user_id
          AND gm.active = true
          AND gm.joined_at::date <= _split.purchase_date
          AND (gm.left_at IS NULL OR gm.left_at::date > _split.purchase_date)
      LOOP
        INSERT INTO public.expense_splits(expense_id, user_id, amount)
        VALUES (_split.expense_id, _member.user_id, _split_amount);
      END LOOP;
    ELSE
      SELECT COALESCE(sum(gm.split_percentage), 0)
        INTO _total_pct
      FROM public.group_members gm
      WHERE gm.group_id = _group_id
        AND gm.user_id <> _target_user_id
        AND gm.active = true
        AND gm.joined_at::date <= _split.purchase_date
        AND (gm.left_at IS NULL OR gm.left_at::date > _split.purchase_date);

      IF _total_pct <= 0 THEN
        RAISE EXCEPTION 'No percentage basis to redistribute split %', _split.id;
      END IF;

      FOR _member IN
        SELECT gm.user_id, COALESCE(gm.split_percentage, 0) AS pct
        FROM public.group_members gm
        WHERE gm.group_id = _group_id
          AND gm.user_id <> _target_user_id
          AND gm.active = true
          AND gm.joined_at::date <= _split.purchase_date
          AND (gm.left_at IS NULL OR gm.left_at::date > _split.purchase_date)
      LOOP
        _split_amount := round(_split.amount * _member.pct / _total_pct, 2);
        INSERT INTO public.expense_splits(expense_id, user_id, amount)
        VALUES (_split.expense_id, _member.user_id, _split_amount);
      END LOOP;
    END IF;

    _redistributed_count := _redistributed_count + 1;
  END LOOP;

  UPDATE public.group_members gm
  SET
    active = false,
    left_at = COALESCE(gm.left_at, _effective_ts)
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
    jsonb_build_object(
      'reason', _reason,
      'effective_date', _effective_date,
      'preserved_pending_splits', _preserved_count,
      'redistributed_pending_splits', _redistributed_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'effective_date', _effective_date,
    'preserved_pending_splits', _preserved_count,
    'redistributed_pending_splits', _redistributed_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_group_member(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid, text) TO authenticated;

-- 3) Aceite de convite com política de retorno:
--    - retorno só sem débito pendente
--    - mesma competência: reativa vínculo anterior
--    - competência diferente: cria novo vínculo
CREATE OR REPLACE FUNCTION public.accept_invite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invite record;
  _user_id uuid := auth.uid();
  _user_email text;
  _debt numeric := 0;
  _existing_active boolean := false;
  _now date := CURRENT_DATE;
  _closing_day int := 1;
  _current_date date;
  _current_month_start date;
  _previous_month_start date;
  _cycle_start date;
  _cycle_end date;
  _last_inactive_id uuid;
  _last_left_at timestamptz;
BEGIN
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;

  SELECT * INTO _invite
  FROM public.invites
  WHERE token = _token AND status = 'pending' AND expires_at > now();

  IF _invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;

  IF lower(_invite.email) <> lower(_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este convite não é para este email');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _invite.group_id
      AND gm.user_id = _user_id
      AND gm.active = true
  ) INTO _existing_active;

  IF _existing_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você já é membro deste grupo');
  END IF;

  -- Regra 6: não retorna se houver débitos pendentes no grupo.
  SELECT COALESCE(sum(es.amount), 0)
    INTO _debt
  FROM public.expense_splits es
  JOIN public.expenses e ON e.id = es.expense_id
  WHERE es.user_id = _user_id
    AND es.status = 'pending'
    AND e.group_id = _invite.group_id
    AND e.expense_type = 'collective';

  IF _debt > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retorno não permitido: existem débitos pendentes');
  END IF;

  SELECT COALESCE(g.closing_day, 1) INTO _closing_day
  FROM public.groups g
  WHERE g.id = _invite.group_id;

  -- Espelha lógica de competência usada no app.
  IF EXTRACT(DAY FROM _now) >= _closing_day THEN
    _current_date := (_now + interval '1 month')::date;
  ELSE
    _current_date := _now;
  END IF;

  _current_month_start := date_trunc('month', _current_date)::date;
  _previous_month_start := (date_trunc('month', _current_date) - interval '1 month')::date;

  _cycle_end := make_date(
    EXTRACT(YEAR FROM _current_month_start)::int,
    EXTRACT(MONTH FROM _current_month_start)::int,
    LEAST(_closing_day, EXTRACT(DAY FROM (_current_month_start + interval '1 month - 1 day'))::int)
  );

  _cycle_start := make_date(
    EXTRACT(YEAR FROM _previous_month_start)::int,
    EXTRACT(MONTH FROM _previous_month_start)::int,
    LEAST(_closing_day, EXTRACT(DAY FROM (_previous_month_start + interval '1 month - 1 day'))::int)
  );

  SELECT gm.id, gm.left_at
    INTO _last_inactive_id, _last_left_at
  FROM public.group_members gm
  WHERE gm.group_id = _invite.group_id
    AND gm.user_id = _user_id
    AND gm.active = false
  ORDER BY gm.left_at DESC NULLS LAST
  LIMIT 1;

  IF _last_inactive_id IS NOT NULL
     AND _last_left_at IS NOT NULL
     AND _last_left_at::date >= _cycle_start
     AND _last_left_at::date < _cycle_end THEN
    -- Regra 7a: mesma competência -> reativação (desativação acidental)
    UPDATE public.group_members gm
    SET active = true,
        left_at = NULL
    WHERE gm.id = _last_inactive_id;
  ELSE
    -- Regra 7b: competência diferente -> novo vínculo
    INSERT INTO public.group_members (group_id, user_id, joined_at, active)
    VALUES (_invite.group_id, _user_id, now(), true);
  END IF;

  INSERT INTO public.user_roles (user_id, group_id, role)
  VALUES (_user_id, _invite.group_id, 'morador')
  ON CONFLICT (user_id, group_id) DO UPDATE SET role = 'morador';

  UPDATE public.invites SET status = 'accepted' WHERE id = _invite.id;

  PERFORM public.create_notification(
    _invite.invited_by, _invite.group_id,
    'Convite aceito',
    coalesce(_user_email, 'Usuário') || ' aceitou o convite para o grupo',
    'invite_accepted',
    jsonb_build_object('user_id', _user_id::text, 'email', _user_email)
  );

  PERFORM public.create_audit_log(
    _invite.group_id, _user_id, 'accept_invite', 'invite', _invite.id,
    jsonb_build_object('email', _user_email)
  );

  RETURN jsonb_build_object('success', true, 'group_id', _invite.group_id);
END;
$function$;
