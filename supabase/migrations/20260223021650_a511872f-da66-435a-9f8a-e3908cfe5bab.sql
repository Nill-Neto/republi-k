
-- 1. Add authorization checks to create_notification function
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _group_id uuid,
  _title text,
  _message text,
  _type text,
  _data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
  _caller_id uuid := auth.uid();
BEGIN
  -- Input validation
  IF _user_id IS NULL OR _group_id IS NULL THEN
    RAISE EXCEPTION 'user_id and group_id are required';
  END IF;

  IF length(_title) > 200 OR length(_message) > 1000 THEN
    RAISE EXCEPTION 'Title or message too long';
  END IF;

  -- Authorization: Caller must be member of the group
  IF NOT public.is_member_of_group(_caller_id, _group_id) THEN
    RAISE EXCEPTION 'Not authorized to create notifications for this group';
  END IF;

  -- Target user must also be member of the group
  IF NOT public.is_member_of_group(_user_id, _group_id) THEN
    RAISE EXCEPTION 'Target user is not a member of this group';
  END IF;

  INSERT INTO public.notifications (user_id, group_id, title, message, type, data)
  VALUES (_user_id, _group_id, _title, _message, _type, _data)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- 2. Add server-side CPF validation via trigger (not CHECK constraint to avoid immutability issues)
CREATE OR REPLACE FUNCTION public.validate_cpf_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  cleaned text;
  v_sum int;
  v_remainder int;
  i int;
BEGIN
  -- Strip non-digits
  cleaned := regexp_replace(NEW.cpf, '\D', '', 'g');

  -- Length check
  IF length(cleaned) != 11 THEN
    RAISE EXCEPTION 'CPF inválido: deve ter 11 dígitos';
  END IF;

  -- Reject all same digits
  IF cleaned ~ '^(\d)\1{10}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  -- First check digit
  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + substring(cleaned, i, 1)::int * (11 - i);
  END LOOP;
  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 THEN v_remainder := 0; END IF;
  IF v_remainder != substring(cleaned, 10, 1)::int THEN
    RAISE EXCEPTION 'CPF inválido: dígito verificador incorreto';
  END IF;

  -- Second check digit
  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + substring(cleaned, i, 1)::int * (12 - i);
  END LOOP;
  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 THEN v_remainder := 0; END IF;
  IF v_remainder != substring(cleaned, 11, 1)::int THEN
    RAISE EXCEPTION 'CPF inválido: dígito verificador incorreto';
  END IF;

  -- Store cleaned version
  NEW.cpf := cleaned;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_cpf_before_upsert
  BEFORE INSERT OR UPDATE ON public.profile_sensitive
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cpf_trigger();
