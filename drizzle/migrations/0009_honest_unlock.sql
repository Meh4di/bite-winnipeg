-- Small plates (lighter portion, lower price) for the "eat well for less" filters.
ALTER TABLE public.menu_items ADD COLUMN is_small_plate boolean NOT NULL DEFAULT false;

-- =====================================================================
-- UNLOCK DEALS: a deal that only switches on if enough people join.
-- Customers get a bigger discount; the restaurant only discounts when the
-- volume is guaranteed; if the goal isn't reached, nobody owes anything.
-- =====================================================================
CREATE TABLE public.unlock_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 300),
  photo_url text,
  regular_price_cents integer NOT NULL CHECK (regular_price_cents BETWEEN 100 AND 50000),
  deal_price_cents integer NOT NULL CHECK (deal_price_cents >= 0),
  goal integer NOT NULL CHECK (goal BETWEEN 2 AND 500),
  max_spots integer NOT NULL,
  ends_at timestamptz NOT NULL,
  pickup_until timestamptz NOT NULL,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deal_price_cents < regular_price_cents),
  CHECK (max_spots BETWEEN goal AND 1000),
  CHECK (pickup_until > ends_at AND pickup_until <= ends_at + interval '3 days')
);
CREATE INDEX unlock_deals_live ON public.unlock_deals (ends_at) WHERE NOT cancelled;
ALTER TABLE public.unlock_deals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unlock_deals FROM anon, authenticated;
GRANT SELECT ON public.unlock_deals TO anon, authenticated;
GRANT INSERT (restaurant_id, title, description, photo_url, regular_price_cents, deal_price_cents, goal, max_spots, ends_at, pickup_until)
  ON public.unlock_deals TO authenticated;
GRANT UPDATE (title, description, photo_url, cancelled) ON public.unlock_deals TO authenticated;
GRANT ALL ON public.unlock_deals TO service_role;
CREATE POLICY "Unlock deals public" ON public.unlock_deals FOR SELECT
  USING (public.owns_restaurant(restaurant_id)
         OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.is_active));
CREATE POLICY "Verified owners create unlock deals" ON public.unlock_deals FOR INSERT TO authenticated
  WITH CHECK (public.owns_restaurant(restaurant_id) AND public.is_verified_restaurant(restaurant_id)
              AND ends_at BETWEEN now() + interval '30 minutes' AND now() + interval '7 days');
CREATE POLICY "Owners edit unlock deals" ON public.unlock_deals FOR UPDATE TO authenticated
  USING (public.owns_restaurant(restaurant_id)) WITH CHECK (public.owns_restaurant(restaurant_id));

CREATE TABLE public.unlock_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.unlock_deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id)
);
CREATE INDEX unlock_pledges_user ON public.unlock_pledges (user_id);
ALTER TABLE public.unlock_pledges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unlock_pledges FROM anon, authenticated;
GRANT SELECT ON public.unlock_pledges TO authenticated;
GRANT ALL ON public.unlock_pledges TO service_role;
CREATE POLICY "See own pledges, owners see their deal's pledges" ON public.unlock_pledges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.unlock_deals d WHERE d.id = deal_id AND public.owns_restaurant(d.restaurant_id)));

-- Short pickup code shown on the customer's pass and in the owner's list.
CREATE OR REPLACE FUNCTION public.unlock_code(_pledge uuid) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(left(replace(_pledge::text, '-', ''), 6))
$$;
GRANT EXECUTE ON FUNCTION public.unlock_code(uuid) TO authenticated;

-- Progress for every live (or recently finished) deal, plus whether I've joined.
CREATE OR REPLACE FUNCTION public.unlock_progress()
RETURNS TABLE (deal_id uuid, joined integer, mine boolean, my_code text, redeemed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id,
         (SELECT count(*)::integer FROM public.unlock_pledges p WHERE p.deal_id = d.id),
         EXISTS (SELECT 1 FROM public.unlock_pledges p WHERE p.deal_id = d.id AND p.user_id = auth.uid()),
         (SELECT public.unlock_code(p.id) FROM public.unlock_pledges p WHERE p.deal_id = d.id AND p.user_id = auth.uid()),
         coalesce((SELECT p.redeemed_at IS NOT NULL FROM public.unlock_pledges p WHERE p.deal_id = d.id AND p.user_id = auth.uid()), false)
    FROM public.unlock_deals d
    JOIN public.restaurants r ON r.id = d.restaurant_id
   WHERE (r.is_active OR r.owner_id = auth.uid())
     AND d.pickup_until > now() - interval '1 day'
$$;
GRANT EXECUTE ON FUNCTION public.unlock_progress() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_unlock(p_deal_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.unlock_deals; n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join'; END IF;
  SELECT * INTO d FROM public.unlock_deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND OR d.cancelled OR NOT public.is_verified_restaurant(d.restaurant_id) THEN RAISE EXCEPTION 'This deal isn''t available'; END IF;
  IF d.ends_at <= now() THEN RAISE EXCEPTION 'This deal has closed'; END IF;
  IF public.owns_restaurant(d.restaurant_id) THEN RAISE EXCEPTION 'You can''t join your own deal'; END IF;
  SELECT count(*) INTO n FROM public.unlock_pledges WHERE deal_id = d.id;
  IF n >= d.max_spots THEN RAISE EXCEPTION 'All spots are taken'; END IF;
  INSERT INTO public.unlock_pledges (deal_id, user_id) VALUES (d.id, auth.uid()) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.activity (user_id, kind, restaurant_id) VALUES (auth.uid(), 'unlock', d.restaurant_id);
  END IF;
  RETURN (SELECT count(*)::integer FROM public.unlock_pledges WHERE deal_id = d.id);
END $$;
REVOKE ALL ON FUNCTION public.join_unlock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_unlock(uuid) TO authenticated;

-- You can drop out until the deadline, unless the goal was already reached (then the kitchen is counting on you).
CREATE OR REPLACE FUNCTION public.leave_unlock(p_deal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.unlock_deals; n integer;
BEGIN
  SELECT * INTO d FROM public.unlock_deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF d.ends_at <= now() THEN RAISE EXCEPTION 'This deal has closed'; END IF;
  SELECT count(*) INTO n FROM public.unlock_pledges WHERE deal_id = d.id;
  IF n >= d.goal THEN RAISE EXCEPTION 'This deal is already unlocked, so your spot is locked in. Contact the restaurant if you can''t make it.'; END IF;
  DELETE FROM public.unlock_pledges WHERE deal_id = d.id AND user_id = auth.uid();
  IF FOUND THEN
    DELETE FROM public.activity WHERE id = (
      SELECT id FROM public.activity WHERE user_id = auth.uid() AND kind = 'unlock' AND restaurant_id = d.restaurant_id
       ORDER BY created_at DESC LIMIT 1);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.leave_unlock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_unlock(uuid) TO authenticated;

-- Owner's list of who's coming, with pickup codes.
CREATE OR REPLACE FUNCTION public.unlock_pledge_list(p_deal_id uuid)
RETURNS TABLE (pledge_id uuid, code text, first_name text, redeemed_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unlock_deals d WHERE d.id = p_deal_id AND public.owns_restaurant(d.restaurant_id)) THEN
    RAISE EXCEPTION 'Only the restaurant can see this';
  END IF;
  RETURN QUERY
    SELECT p.id, public.unlock_code(p.id),
           coalesce(nullif(split_part(trim(pr.full_name), ' ', 1), ''), 'Guest'), p.redeemed_at, p.created_at
      FROM public.unlock_pledges p LEFT JOIN public.profiles pr ON pr.id = p.user_id
     WHERE p.deal_id = p_deal_id
     ORDER BY p.created_at;
END $$;
REVOKE ALL ON FUNCTION public.unlock_pledge_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_pledge_list(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_unlock(p_pledge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.unlock_deals; n integer;
BEGIN
  SELECT dl.* INTO d FROM public.unlock_pledges p JOIN public.unlock_deals dl ON dl.id = p.deal_id WHERE p.id = p_pledge_id;
  IF NOT FOUND OR NOT public.owns_restaurant(d.restaurant_id) THEN RAISE EXCEPTION 'Only the restaurant can do this'; END IF;
  SELECT count(*) INTO n FROM public.unlock_pledges WHERE deal_id = d.id;
  IF n < d.goal THEN RAISE EXCEPTION 'This deal hasn''t unlocked'; END IF;
  IF now() > d.pickup_until THEN RAISE EXCEPTION 'The pickup window is over'; END IF;
  UPDATE public.unlock_pledges SET redeemed_at = coalesce(redeemed_at, now()) WHERE id = p_pledge_id;
END $$;
REVOKE ALL ON FUNCTION public.redeem_unlock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_unlock(uuid) TO authenticated;

-- Joining an unlock shows up in friends' feeds (after the usual 1-hour delay).
ALTER TABLE public.activity DROP CONSTRAINT activity_kind_check;
ALTER TABLE public.activity ADD CONSTRAINT activity_kind_check
  CHECK (kind IN ('stamp', 'rescue', 'review', 'badge', 'forward', 'table', 'unlock'));
