
-- 1. Add validation to create_audit_log to prevent impersonation and fake entries
CREATE OR REPLACE FUNCTION public.create_audit_log(
  _group_id uuid,
  _user_id uuid,
  _action text,
  _entity_type text,
  _entity_id uuid DEFAULT NULL,
  _details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
BEGIN
  -- Validate caller is member of the group
  IF NOT public.is_member_of_group(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'Not authorized to create audit log for this group';
  END IF;

  -- Prevent impersonation: non-admins can only log as themselves
  IF _user_id != auth.uid() THEN
    IF NOT public.has_role_in_group(auth.uid(), _group_id, 'admin') THEN
      RAISE EXCEPTION 'Cannot create audit logs for other users';
    END IF;
  END IF;

  INSERT INTO public.audit_log (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (_group_id, _user_id, _action, _entity_type, _entity_id, _details)
  RETURNING id INTO _id;
  
  RETURN _id;
END;
$$;

-- 2. Block direct INSERT/UPDATE/DELETE on audit_log (only via SECURITY DEFINER functions)
CREATE POLICY "No direct inserts to audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No updates to audit log"
  ON public.audit_log FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No deletes from audit log"
  ON public.audit_log FOR DELETE TO authenticated
  USING (false);

-- 3. Normalize invite emails to lowercase on insert
CREATE OR REPLACE FUNCTION public.normalize_invite_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_invite_email_trigger
  BEFORE INSERT OR UPDATE ON public.invites
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_invite_email();

-- 4. Restrict invited user UPDATE policy to only allow status changes via RPC
DROP POLICY IF EXISTS "Invited users can update own invite" ON public.invites;
