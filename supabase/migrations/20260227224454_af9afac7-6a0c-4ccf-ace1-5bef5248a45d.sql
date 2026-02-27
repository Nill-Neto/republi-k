
CREATE OR REPLACE FUNCTION public.remove_group_member(
  _group_id uuid,
  _target_user_id uuid,
  _reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _preserved int := 0;
  _redistributed int := 0;
BEGIN
  -- Only admins can remove members
  IF NOT has_role_in_group(_caller_id, _group_id, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem remover moradores';
  END IF;

  -- Cannot remove yourself
  IF _target_user_id = _caller_id THEN
    RAISE EXCEPTION 'Você não pode remover a si mesmo por este fluxo';
  END IF;

  -- Check target is active member
  IF NOT is_member_of_group(_target_user_id, _group_id) THEN
    RAISE EXCEPTION 'Usuário não é membro ativo deste grupo';
  END IF;

  -- Count pending splits for the target user (preserved = already have payments pending/confirmed)
  SELECT COUNT(*) INTO _preserved
  FROM expense_splits es
  JOIN expenses e ON e.id = es.expense_id
  WHERE e.group_id = _group_id
    AND es.user_id = _target_user_id
    AND es.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM payments p
      WHERE p.expense_split_id = es.id
        AND p.status IN ('pending', 'confirmed')
    );

  -- Count pending splits that will be redistributed (no payment associated)
  SELECT COUNT(*) INTO _redistributed
  FROM expense_splits es
  JOIN expenses e ON e.id = es.expense_id
  WHERE e.group_id = _group_id
    AND es.user_id = _target_user_id
    AND es.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM payments p
      WHERE p.expense_split_id = es.id
    );

  -- Deactivate membership
  UPDATE group_members
  SET active = false, left_at = now()
  WHERE group_id = _group_id AND user_id = _target_user_id;

  -- Remove role
  DELETE FROM user_roles
  WHERE group_id = _group_id AND user_id = _target_user_id;

  -- Audit log
  PERFORM create_audit_log(
    _group_id, _caller_id, 'remove_member', 'group_member', _target_user_id,
    jsonb_build_object('reason', _reason, 'preserved_pending_splits', _preserved, 'redistributed_pending_splits', _redistributed)
  );

  RETURN jsonb_build_object(
    'success', true,
    'preserved_pending_splits', _preserved,
    'redistributed_pending_splits', _redistributed
  );
END;
$$;
