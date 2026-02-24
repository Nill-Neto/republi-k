
-- Re-add a restricted group member profile viewing policy
-- RLS is row-level, so we must allow the row access. 
-- The app code will be updated to only select non-sensitive columns.
CREATE POLICY "Users can view profiles in same group"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT gm.user_id
    FROM group_members gm
    WHERE gm.group_id IN (SELECT get_user_group_ids(auth.uid()))
    AND gm.active = true
  )
);
