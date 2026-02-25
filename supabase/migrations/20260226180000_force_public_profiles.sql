-- Remove explicitamente qualquer política de SELECT anterior para evitar conflitos
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Cria a política definitiva: Todo usuário autenticado pode ler (SELECT) qualquer linha da tabela profiles
-- Importante: A tabela profiles contém apenas dados públicos (Nome, Avatar, Email, Telefone).
-- Dados sensíveis como CPF estão na tabela 'profile_sensitive' que continua restrita.
CREATE POLICY "Public read access for authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);