
-- Delete all data for users nillneto.nutricionista@gmail.com and nillnetodesigner@gmail.com
DO $$
DECLARE
  _ids uuid[] := ARRAY['92ebbe3b-4145-4e71-9b93-122572f02b14','889a299e-69b7-40d8-9f43-b5e3711f0e42']::uuid[];
BEGIN
  DELETE FROM public.expense_splits WHERE user_id = ANY(_ids);
  DELETE FROM public.group_members WHERE user_id = ANY(_ids);
  UPDATE public.audit_log SET user_id = NULL WHERE user_id = ANY(_ids);
  DELETE FROM public.profile_sensitive WHERE user_id = ANY(_ids);
  DELETE FROM public.profiles WHERE id = ANY(_ids);
END;
$$;
