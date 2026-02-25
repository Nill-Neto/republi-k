
-- 1. Drop the EXISTING trigger by its actual name
DROP TRIGGER IF EXISTS validate_cpf_before_upsert ON public.profile_sensitive;

-- 2. Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 3. Create private schema
CREATE SCHEMA IF NOT EXISTS private;

-- 4. Key storage table
CREATE TABLE IF NOT EXISTS private.encryption_keys (
  name text PRIMARY KEY,
  key text NOT NULL
);

-- 5. Generate encryption key
INSERT INTO private.encryption_keys (name, key)
VALUES ('cpf', encode(extensions.gen_random_bytes(32), 'hex'));

-- 6. Revoke API access to private schema
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon, authenticated;

-- 7. Helper to get key
CREATE OR REPLACE FUNCTION private.get_cpf_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'private'
AS $$
  SELECT key FROM private.encryption_keys WHERE name = 'cpf';
$$;

-- 8. Migrate existing plain-text CPFs to encrypted (trigger is dropped, safe to update)
UPDATE public.profile_sensitive
SET cpf = encode(
  extensions.pgp_sym_encrypt(
    cpf,
    (SELECT key FROM private.encryption_keys WHERE name = 'cpf')
  ),
  'base64'
)
WHERE cpf ~ '^\d{11}$';

-- 9. New trigger function: validate then encrypt
CREATE OR REPLACE FUNCTION public.validate_cpf_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  cleaned text;
  _key text;
  v_sum int;
  v_remainder int;
  i int;
BEGIN
  cleaned := regexp_replace(NEW.cpf, '\D', '', 'g');

  -- If not 11 digits, assume already encrypted – skip validation
  IF length(cleaned) != 11 THEN
    RETURN NEW;
  END IF;

  IF cleaned ~ '^(\d)\1{10}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + substring(cleaned, i, 1)::int * (11 - i);
  END LOOP;
  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 THEN v_remainder := 0; END IF;
  IF v_remainder != substring(cleaned, 10, 1)::int THEN
    RAISE EXCEPTION 'CPF inválido: dígito verificador incorreto';
  END IF;

  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + substring(cleaned, i, 1)::int * (12 - i);
  END LOOP;
  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 THEN v_remainder := 0; END IF;
  IF v_remainder != substring(cleaned, 11, 1)::int THEN
    RAISE EXCEPTION 'CPF inválido: dígito verificador incorreto';
  END IF;

  SELECT private.get_cpf_key() INTO _key;
  NEW.cpf := encode(pgp_sym_encrypt(cleaned, _key), 'base64');
  RETURN NEW;
END;
$$;

-- 10. Re-create trigger with new name
CREATE TRIGGER trg_validate_encrypt_cpf
  BEFORE INSERT OR UPDATE ON public.profile_sensitive
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cpf_trigger();

-- 11. RPC: read own CPF (decrypted)
CREATE OR REPLACE FUNCTION public.read_my_cpf()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _encrypted text;
  _key text;
BEGIN
  SELECT cpf INTO _encrypted FROM public.profile_sensitive WHERE user_id = auth.uid();
  IF _encrypted IS NULL THEN RETURN NULL; END IF;
  SELECT private.get_cpf_key() INTO _key;
  RETURN pgp_sym_decrypt(decode(_encrypted, 'base64'), _key);
END;
$$;

-- 12. RPC: admin reads member CPF (decrypted)
CREATE OR REPLACE FUNCTION public.admin_read_cpf(_target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _encrypted text;
  _key text;
BEGIN
  IF NOT public.is_admin_of_user(auth.uid(), _target_user_id) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  SELECT cpf INTO _encrypted FROM public.profile_sensitive WHERE user_id = _target_user_id;
  IF _encrypted IS NULL THEN RETURN NULL; END IF;
  SELECT private.get_cpf_key() INTO _key;
  RETURN pgp_sym_decrypt(decode(_encrypted, 'base64'), _key);
END;
$$;
