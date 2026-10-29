-- =====================================================================
-- DROPS, LAST-CALL DEALS AND PROMOTIONS
-- =====================================================================
ALTER TABLE public.drops
  ADD COLUMN kind text NOT NULL DEFAULT 'drop' CHECK (kind IN ('drop', 'leftover')),
  ADD COLUMN original_price_cents integer CHECK (original_price_cents IS NULL OR original_price_cents >= 0),
  ADD CONSTRAINT drops_quantity_ok CHECK (quantity_total >= 1 AND quantity_total <= 1000 AND quantity_left >= 0 AND quantity_left <= quantity_total),
  ADD CONSTRAINT drops_price_ok CHECK (price_cents >= 0 AND price_cents <= 100000),
  ADD CONSTRAINT drops_window_ok CHECK (ends_at IS NULL OR ends_at > starts_at),
  ADD CONSTRAINT drops_title_ok CHECK (length(title) BETWEEN 1 AND 80);
CREATE INDEX drops_restaurant_starts ON public.drops(restaurant_id, starts_at);
CREATE INDEX drops_live ON public.drops(starts_at, ends_at);

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_window_ok CHECK (ends_at IS NULL OR ends_at > starts_at),
  ADD CONSTRAINT promotions_title_ok CHECK (length(title) BETWEEN 1 AND 80);
CREATE INDEX promotions_restaurant_starts ON public.promotions(restaurant_id, starts_at);

-- Keep stock honest: new drops start full; changing the total shifts what is left.
CREATE OR REPLACE FUNCTION public.drops_sync_quantity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.quantity_left := NEW.quantity_total;
  ELSIF NEW.quantity_total IS DISTINCT FROM OLD.quantity_total THEN
    NEW.quantity_left := greatest(0, least(NEW.quantity_total, OLD.quantity_left + (NEW.quantity_total - OLD.quantity_total)));
  ELSIF NEW.quantity_left IS DISTINCT FROM OLD.quantity_left AND current_setting('bite.claiming', true) IS DISTINCT FROM 'on' THEN
    NEW.quantity_left := OLD.quantity_left;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER drops_sync_quantity BEFORE INSERT OR UPDATE ON public.drops FOR EACH ROW EXECUTE FUNCTION public.drops_sync_quantity();

ALTER TABLE public.orders ADD COLUMN drop_id uuid REFERENCES public.drops(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX orders_one_claim_per_drop ON public.orders(drop_id, user_id) WHERE drop_id IS NOT NULL AND status <> 'cancelled';

-- =====================================================================
-- PASSPORT: LEVELS, BADGES, VISIT STAMPS, REWARDS
-- =====================================================================
-- Levels: 0 Bronze (0-4 stamps), 1 Silver (5-14), 2 Gold (15-29), 3 Maple (30+)
CREATE OR REPLACE FUNCTION public.level_for(_stamps integer) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _stamps >= 30 THEN 3 WHEN _stamps >= 15 THEN 2 WHEN _stamps >= 5 THEN 1 ELSE 0 END
$$;
CREATE OR REPLACE FUNCTION public.my_level() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.level_for((SELECT count(*)::integer FROM public.stamps WHERE user_id = auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.my_level() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_level() TO anon, authenticated;

INSERT INTO public.badges(code, name, description, icon) VALUES
  ('regular', 'Regular', 'Collect 5 stamps at one spot', '🔁'),
  ('drop_hunter', 'Drop Hunter', 'Pick up 3 drops', '🔥'),
  ('explorer', 'Explorer', 'Collect stamps at 10 different spots', '🧭'),
  ('maple_level', 'True North', 'Reach Maple level', '🍁')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.award_badges(_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total integer; spots integer; coffee integer; hoods integer; best integer; drops integer;
BEGIN
  SELECT count(*), count(DISTINCT s.restaurant_id),
         count(DISTINCT s.restaurant_id) FILTER (WHERE r.category = 'Coffee'),
         count(DISTINCT r.neighbourhood),
         count(*) FILTER (WHERE s.source = 'drop')
    INTO total, spots, coffee, hoods, drops
    FROM public.stamps s JOIN public.restaurants r ON r.id = s.restaurant_id
   WHERE s.user_id = _user;
  SELECT coalesce(max(c), 0) INTO best FROM (SELECT count(*) c FROM public.stamps WHERE user_id = _user GROUP BY restaurant_id) x;
  INSERT INTO public.user_badges(user_id, badge_id)
  SELECT _user, b.id FROM public.badges b
   WHERE (b.code = 'first_stamp' AND total >= 1)
      OR (b.code = 'coffee_crawler' AND coffee >= 5)
      OR (b.code = 'neighbourhood_hopper' AND hoods >= 4)
      OR (b.code = 'regular' AND best >= 5)
      OR (b.code = 'drop_hunter' AND drops >= 3)
      OR (b.code = 'explorer' AND spots >= 10)
      OR (b.code = 'maple_level' AND total >= 30)
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.award_badges(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.stamps_award_badges() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.award_badges(NEW.user_id); RETURN NEW; END $$;
CREATE TRIGGER stamps_award_badges AFTER INSERT ON public.stamps FOR EACH ROW EXECUTE FUNCTION public.stamps_award_badges();

-- Pickup stamps: drops earn a 'drop' stamp, regular orders an 'order' stamp.
CREATE OR REPLACE FUNCTION public.award_order_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'picked_up' AND OLD.status IS DISTINCT FROM 'picked_up' THEN
    INSERT INTO public.stamps(user_id, restaurant_id, source, order_id)
    VALUES (NEW.user_id, NEW.restaurant_id, CASE WHEN NEW.drop_id IS NULL THEN 'order' ELSE 'drop' END::public.stamp_source, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- Visit stamps: the counter shows a rotating code (as a QR); customers scan it.
CREATE TABLE public.restaurant_secrets (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  stamp_secret text NOT NULL DEFAULT md5(gen_random_uuid()::text || clock_timestamp()::text)
);
ALTER TABLE public.restaurant_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_secrets FROM anon, authenticated;
GRANT ALL ON public.restaurant_secrets TO service_role;

CREATE OR REPLACE FUNCTION public._stamp_code(_restaurant_id uuid, _window bigint) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT upper(substr(md5(stamp_secret || ':' || _window::text), 1, 6)) FROM public.restaurant_secrets WHERE restaurant_id = _restaurant_id
$$;
REVOKE ALL ON FUNCTION public._stamp_code(uuid, bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_stamp_code(p_restaurant_id uuid)
RETURNS TABLE(code text, expires_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w bigint := floor(extract(epoch FROM now()) / 120)::bigint;
BEGIN
  IF NOT public.owns_restaurant(p_restaurant_id) THEN RAISE EXCEPTION 'Only the owner can show the stamp code'; END IF;
  INSERT INTO public.restaurant_secrets(restaurant_id) VALUES (p_restaurant_id) ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT public._stamp_code(p_restaurant_id, w), to_timestamp((w + 1) * 120);
END $$;
REVOKE ALL ON FUNCTION public.get_stamp_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_stamp_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_visit_stamp(p_slug text, p_code text)
RETURNS TABLE(restaurant_name text, restaurant_slug text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.restaurants%ROWTYPE; w bigint := floor(extract(epoch FROM now()) / 120)::bigint; c text := upper(trim(coalesce(p_code, '')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to collect stamps'; END IF;
  SELECT * INTO r FROM public.restaurants WHERE slug = p_slug AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spot not found'; END IF;
  IF r.owner_id = auth.uid() THEN RAISE EXCEPTION 'You can''t stamp your own spot'; END IF;
  IF c = '' OR c IS DISTINCT FROM public._stamp_code(r.id, w) AND c IS DISTINCT FROM public._stamp_code(r.id, w - 1) THEN
    RAISE EXCEPTION 'That code expired. Scan the code at the counter again.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.stamps WHERE user_id = auth.uid() AND restaurant_id = r.id AND source = 'visit'
             AND (created_at AT TIME ZONE 'America/Winnipeg')::date = (now() AT TIME ZONE 'America/Winnipeg')::date) THEN
    RAISE EXCEPTION 'Already stamped here today. Come back tomorrow!';
  END IF;
  INSERT INTO public.stamps(user_id, restaurant_id, source) VALUES (auth.uid(), r.id, 'visit');
  RETURN QUERY SELECT r.name, r.slug;
END $$;
REVOKE ALL ON FUNCTION public.claim_visit_stamp(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_visit_stamp(text, text) TO authenticated;

-- Rewards: every 5 stamps at a spot unlocks one reward.
CREATE TABLE public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reward_redemptions_user ON public.reward_redemptions(user_id, restaurant_id);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
CREATE POLICY "Read own or restaurant redemptions" ON public.reward_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_restaurant(restaurant_id));

CREATE OR REPLACE FUNCTION public.redeem_reward(p_restaurant_id uuid)
RETURNS TABLE(id uuid, created_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE earned integer; used integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || p_restaurant_id::text));
  SELECT count(*) / 5 INTO earned FROM public.stamps WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id;
  SELECT count(*) INTO used FROM public.reward_redemptions rr WHERE rr.user_id = auth.uid() AND rr.restaurant_id = p_restaurant_id;
  IF earned - used <= 0 THEN RAISE EXCEPTION 'No reward available yet'; END IF;
  RETURN QUERY INSERT INTO public.reward_redemptions AS rr(user_id, restaurant_id) VALUES (auth.uid(), p_restaurant_id) RETURNING rr.id, rr.created_at;
END $$;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

-- =====================================================================
-- SECRET MENU
-- =====================================================================
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_level_ok CHECK (required_level BETWEEN 0 AND 3);
DROP POLICY "Public menu items" ON public.menu_items;
CREATE POLICY "Public menu items" ON public.menu_items FOR SELECT USING (
  NOT is_secret OR public.owns_restaurant(restaurant_id) OR (auth.uid() IS NOT NULL AND public.my_level() >= required_level)
);

CREATE OR REPLACE FUNCTION public.secret_menu_teaser(p_restaurant_id uuid)
RETURNS TABLE(locked_count integer, next_level integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer, min(required_level)::integer FROM public.menu_items
   WHERE restaurant_id = p_restaurant_id AND is_secret AND is_available
     AND (auth.uid() IS NULL OR required_level > public.my_level())
$$;
GRANT EXECUTE ON FUNCTION public.secret_menu_teaser(uuid) TO anon, authenticated;

-- =====================================================================
-- DROP CLAIMS (a claim is a paid pickup order for one item)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_drop(p_drop_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.drops%ROWTYPE; r public.restaurants%ROWTYPE; oid uuid; pname text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to claim'; END IF;
  SELECT * INTO d FROM public.drops WHERE id = p_drop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF d.starts_at > now() THEN RAISE EXCEPTION 'Not live yet. Hang tight!'; END IF;
  IF d.ends_at IS NOT NULL AND d.ends_at <= now() THEN RAISE EXCEPTION 'This one has ended'; END IF;
  IF d.quantity_left <= 0 THEN RAISE EXCEPTION 'Sold out!'; END IF;
  SELECT * INTO r FROM public.restaurants WHERE id = d.restaurant_id;
  IF NOT r.is_active OR NOT r.accepting_orders THEN RAISE EXCEPTION 'Not taking orders right now'; END IF;
  IF r.owner_id = auth.uid() THEN RAISE EXCEPTION 'You can''t claim your own drop'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE drop_id = d.id AND user_id = auth.uid() AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'You already claimed this one';
  END IF;
  PERFORM set_config('bite.claiming', 'on', true);
  UPDATE public.drops SET quantity_left = quantity_left - 1 WHERE id = d.id;
  PERFORM set_config('bite.claiming', 'off', true);
  SELECT coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Guest') INTO pname FROM public.profiles WHERE profiles.id = auth.uid();
  INSERT INTO public.orders(user_id, restaurant_id, status, pickup_time, total_cents, note, customer_name, payment_mode, drop_id)
  VALUES (auth.uid(), d.restaurant_id, 'paid', now() + interval '15 minutes', d.price_cents, '', coalesce(pname, 'Guest'), 'test', d.id)
  RETURNING orders.id INTO oid;
  INSERT INTO public.order_items(order_id, menu_item_id, quantity, price_cents, item_name)
  VALUES (oid, NULL, 1, d.price_cents, CASE WHEN d.kind = 'leftover' THEN 'Last call: ' ELSE 'Drop: ' END || d.title);
  IF d.kind = 'drop' AND now() - d.starts_at <= interval '5 minutes' THEN
    INSERT INTO public.user_badges(user_id, badge_id) SELECT auth.uid(), b.id FROM public.badges b WHERE b.code = 'early_bird' ON CONFLICT DO NOTHING;
  END IF;
  RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.claim_drop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_drop(uuid) TO authenticated;

-- =====================================================================
-- DECIDE: SWIPE WITH FRIENDS
-- =====================================================================
CREATE TABLE public.decide_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.decide_members (
  session_id uuid NOT NULL REFERENCES public.decide_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT 'Friend',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
CREATE TABLE public.decide_votes (
  session_id uuid NOT NULL REFERENCES public.decide_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  liked boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id, restaurant_id)
);
CREATE OR REPLACE FUNCTION public.is_decide_member(_session_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.decide_members WHERE session_id = _session_id AND user_id = auth.uid())
$$;
ALTER TABLE public.decide_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decide_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decide_votes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.decide_sessions, public.decide_members, public.decide_votes TO authenticated;
GRANT INSERT, UPDATE ON public.decide_votes TO authenticated;
GRANT ALL ON public.decide_sessions, public.decide_members, public.decide_votes TO service_role;
CREATE POLICY "Members read session" ON public.decide_sessions FOR SELECT TO authenticated USING (public.is_decide_member(id));
CREATE POLICY "Members read members" ON public.decide_members FOR SELECT TO authenticated USING (public.is_decide_member(session_id));
CREATE POLICY "Members read votes" ON public.decide_votes FOR SELECT TO authenticated USING (public.is_decide_member(session_id));
CREATE POLICY "Members vote" ON public.decide_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_decide_member(session_id));
CREATE POLICY "Members change vote" ON public.decide_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_decide_member(session_id));

CREATE OR REPLACE FUNCTION public.create_decide_session(p_category text DEFAULT NULL)
RETURNS TABLE(id uuid, code text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text; sid uuid; pname text; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to decide with friends'; END IF;
  LOOP
    c := '';
    FOR i IN 1..5 LOOP c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.decide_sessions s WHERE s.code = c);
  END LOOP;
  INSERT INTO public.decide_sessions(code, created_by, category) VALUES (c, auth.uid(), nullif(p_category, '')) RETURNING decide_sessions.id INTO sid;
  SELECT coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Friend') INTO pname FROM public.profiles WHERE profiles.id = auth.uid();
  INSERT INTO public.decide_members(session_id, user_id, display_name) VALUES (sid, auth.uid(), coalesce(pname, 'Friend'));
  RETURN QUERY SELECT sid, c;
END $$;
REVOKE ALL ON FUNCTION public.create_decide_session(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_decide_session(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_decide_session(p_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; pname text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join'; END IF;
  SELECT s.id INTO sid FROM public.decide_sessions s WHERE s.code = upper(trim(p_code)) AND s.created_at > now() - interval '1 day';
  IF sid IS NULL THEN RAISE EXCEPTION 'No group with that code (codes last 24 hours)'; END IF;
  IF (SELECT count(*) FROM public.decide_members WHERE session_id = sid) >= 12 THEN RAISE EXCEPTION 'This group is full'; END IF;
  SELECT coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Friend') INTO pname FROM public.profiles WHERE profiles.id = auth.uid();
  INSERT INTO public.decide_members(session_id, user_id, display_name) VALUES (sid, auth.uid(), coalesce(pname, 'Friend')) ON CONFLICT DO NOTHING;
  RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.join_decide_session(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_decide_session(text) TO authenticated;

-- =====================================================================
-- REALTIME
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.drops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.decide_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.decide_members;

-- Checkout: secret-menu items are orderable by customers at the required level.
CREATE OR REPLACE FUNCTION public.checkout_test_order(p_order_id uuid, p_restaurant_id uuid, p_items jsonb, p_note text, p_pickup_time timestamptz DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 r public.restaurants%ROWTYPE; existing public.orders%ROWTYPE; m public.menu_items%ROWTYPE; line jsonb; qty integer; total bigint := 0; name text; pickup timestamptz; local_now timestamp := now() AT TIME ZONE 'America/Winnipeg'; local_pickup timestamp; d date; h jsonb; opens timestamp; closes timestamp; is_open boolean := false; found_day boolean := false; i integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to place an order'; END IF;
 SELECT * INTO existing FROM public.orders WHERE id = p_order_id;
 IF FOUND THEN
  IF existing.user_id <> auth.uid() THEN RAISE EXCEPTION 'Order unavailable'; END IF;
  RETURN existing.id;
 END IF;
 SELECT * INTO r FROM public.restaurants WHERE id = p_restaurant_id FOR SHARE;
 IF NOT FOUND OR NOT r.is_active OR NOT r.accepting_orders THEN RAISE EXCEPTION 'Not taking orders right now'; END IF;
 IF p_note IS NULL OR length(p_note) > 1000 THEN RAISE EXCEPTION 'Note must be at most 1000 characters'; END IF;
 IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 100 THEN RAISE EXCEPTION 'Your cart is empty or too large'; END IF;
 IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Duplicate cart items'; END IF;
 FOR i IN 0..7 LOOP
  d := local_now::date + i;
  h := r.hours->lower(to_char(d, 'Dy'));
  IF h IS NULL OR coalesce((h->>'closed')::boolean, false) OR h->>'open' IS NULL OR h->>'close' IS NULL THEN CONTINUE; END IF;
  opens := d + (h->>'open')::time; closes := d + (h->>'close')::time;
  IF closes <= opens OR closes <= local_now OR (i = 0 AND local_now + interval '15 minutes' >= closes) THEN CONTINUE; END IF;
  is_open := i = 0 AND local_now >= opens AND local_now < closes;
  found_day := true; EXIT;
 END LOOP;
 IF NOT found_day THEN RAISE EXCEPTION 'No pickup times available'; END IF;
 IF p_pickup_time IS NULL THEN
  IF NOT is_open THEN RAISE EXCEPTION 'Choose a scheduled pickup time'; END IF;
  pickup := (local_now + interval '15 minutes') AT TIME ZONE 'America/Winnipeg';
 ELSE pickup := p_pickup_time; END IF;
 local_pickup := pickup AT TIME ZONE 'America/Winnipeg';
 IF local_pickup::date <> d OR local_pickup < opens OR local_pickup >= closes OR pickup < now() + interval '15 minutes' THEN RAISE EXCEPTION 'Choose a valid pickup time within opening hours'; END IF;
 IF p_pickup_time IS NOT NULL AND (extract(minute FROM local_pickup)::integer % 15 <> 0 OR extract(second FROM local_pickup) <> 0) THEN RAISE EXCEPTION 'Pickup slots are every 15 minutes'; END IF;
 FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  qty := (line->>'quantity')::integer;
  IF qty IS NULL OR qty < 1 OR qty > 99 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
  SELECT * INTO m FROM public.menu_items WHERE id = (line->>'id')::uuid AND restaurant_id = r.id AND is_available AND (NOT is_secret OR public.my_level() >= required_level) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An item is no longer available'; END IF;
  total := total + m.price_cents::bigint * qty;
 END LOOP;
 IF total > 2147483647 THEN RAISE EXCEPTION 'Order total too large'; END IF;
 SELECT coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Guest') INTO name FROM public.profiles WHERE id = auth.uid();
 INSERT INTO public.orders(id, user_id, restaurant_id, status, pickup_time, total_cents, note, customer_name, payment_mode) VALUES (p_order_id, auth.uid(), r.id, 'paid', pickup, total::integer, p_note, coalesce(name,'Guest'), 'test');
 FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO m FROM public.menu_items WHERE id = (line->>'id')::uuid;
  INSERT INTO public.order_items(order_id, menu_item_id, quantity, price_cents, item_name) VALUES (p_order_id, m.id, (line->>'quantity')::integer, m.price_cents, m.name);
 END LOOP;
 RETURN p_order_id;
END; $$;
