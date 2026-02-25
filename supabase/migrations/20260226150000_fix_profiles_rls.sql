-- Remove a política restritiva anterior (que permitia ver apenas o próprio perfil)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Cria uma nova política permitindo que qualquer usuário autenticado visualize os perfis básicos
-- Isso expõe: Nome, Email, Telefone, Avatar (Dados sensíveis como CPF estão na tabela profile_sensitive)
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);