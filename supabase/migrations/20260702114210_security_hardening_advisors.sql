-- Pin search_path on the updated_at trigger function
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- ab_experiments was missing a policy (god-only, Bluestift internal)
DROP POLICY IF EXISTS ab_experiments_god ON schools.ab_experiments;
CREATE POLICY ab_experiments_god ON schools.ab_experiments
  FOR ALL USING (public.is_god());

-- handle_new_user is a trigger function only; it must not be RPC-callable
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
