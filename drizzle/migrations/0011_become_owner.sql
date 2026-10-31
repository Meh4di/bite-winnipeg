-- Lets a signed-in customer add a business to their account. Safe because every business tool,
-- public page and order is locked until the restaurant is verified by a Bite admin.
CREATE OR REPLACE FUNCTION public.become_restaurant_owner()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'restaurant_owner') ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.become_restaurant_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.become_restaurant_owner() TO authenticated;
