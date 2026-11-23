-- "Get my spot on Bity": customers ask real, unclaimed spots to join. The count is the founder's pitch
-- ("47 people asked for you"). Also diet tags (halal, vegan, vegetarian, gluten-free) restaurants set themselves.

CREATE TABLE public.spot_requests (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, user_id)
);
ALTER TABLE public.spot_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spot_requests FROM anon, authenticated;
GRANT SELECT ON public.spot_requests TO authenticated;
CREATE POLICY "Own requests" ON public.spot_requests FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Ask a spot to join. Also follows it, so its first deal shows up for you when it joins.
CREATE OR REPLACE FUNCTION public.request_spot(p_restaurant_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id AND verification_status = 'unclaimed') THEN
    RAISE EXCEPTION 'This spot is already on Bity';
  END IF;
  INSERT INTO public.spot_requests (restaurant_id, user_id) VALUES (p_restaurant_id, auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.follows (user_id, restaurant_id) VALUES (auth.uid(), p_restaurant_id) ON CONFLICT DO NOTHING;
  SELECT count(*) INTO n FROM public.spot_requests WHERE restaurant_id = p_restaurant_id;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.request_spot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_spot(uuid) TO authenticated;

-- Public count + whether I asked. Counts only; never who asked.
CREATE OR REPLACE FUNCTION public.spot_request_info(p_restaurant_id uuid)
RETURNS TABLE (requests integer, mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*)::integer FROM public.spot_requests WHERE restaurant_id = p_restaurant_id),
         EXISTS (SELECT 1 FROM public.spot_requests WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.spot_request_info(uuid) TO anon, authenticated;

-- For the admin's pitch list: most-requested spots that haven't joined yet.
CREATE OR REPLACE FUNCTION public.admin_top_requests()
RETURNS TABLE (restaurant_id uuid, name text, slug text, neighbourhood text, address text, requests integer, last_request timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT r.id, r.name, r.slug, r.neighbourhood, r.address, count(*)::integer, max(q.created_at)
      FROM public.spot_requests q JOIN public.restaurants r ON r.id = q.restaurant_id
     WHERE r.verification_status = 'unclaimed'
     GROUP BY r.id ORDER BY count(*) DESC, max(q.created_at) DESC LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.admin_top_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_top_requests() TO authenticated;

-- ---------- diet tags ----------
ALTER TABLE public.restaurants ADD COLUMN diet_tags text[] NOT NULL DEFAULT '{}'
  CHECK (diet_tags <@ ARRAY['halal','vegan','vegetarian','gluten-free']::text[]);
