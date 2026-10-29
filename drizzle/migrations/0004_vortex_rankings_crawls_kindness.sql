-- =====================================================================
-- POLAR VORTEX DEALS: promos that unlock when Winnipeg gets cold enough
-- =====================================================================
ALTER TABLE public.promotions
  ADD COLUMN vortex_only boolean NOT NULL DEFAULT false,
  ADD COLUMN unlock_temp_c integer NOT NULL DEFAULT -25 CHECK (unlock_temp_c BETWEEN -50 AND 0);

-- =====================================================================
-- BEST IN THE PEG: dish types and verified dish ratings
-- =====================================================================
ALTER TABLE public.menu_items ADD COLUMN dish_type text CHECK (dish_type IS NULL OR length(dish_type) <= 30);
CREATE INDEX menu_items_dish_type ON public.menu_items(dish_type) WHERE dish_type IS NOT NULL;

CREATE TABLE public.dish_ratings (
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (menu_item_id, user_id)
);
CREATE INDEX dish_ratings_restaurant ON public.dish_ratings(restaurant_id);
ALTER TABLE public.dish_ratings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.dish_ratings TO anon, authenticated;
GRANT INSERT (menu_item_id, restaurant_id, rating) ON public.dish_ratings TO authenticated;
GRANT UPDATE (rating) ON public.dish_ratings TO authenticated;
GRANT DELETE ON public.dish_ratings TO authenticated;
GRANT ALL ON public.dish_ratings TO service_role;

CREATE OR REPLACE FUNCTION public.dish_ratings_fill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT restaurant_id INTO NEW.restaurant_id FROM public.menu_items WHERE id = NEW.menu_item_id;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER dish_ratings_fill BEFORE INSERT OR UPDATE ON public.dish_ratings FOR EACH ROW EXECUTE FUNCTION public.dish_ratings_fill();

CREATE POLICY "Dish ratings are public" ON public.dish_ratings FOR SELECT USING (true);
CREATE POLICY "Verified visitors rate dishes" ON public.dish_ratings FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND NOT public.owns_restaurant(restaurant_id)
  AND EXISTS (SELECT 1 FROM public.stamps s WHERE s.user_id = auth.uid() AND s.restaurant_id = dish_ratings.restaurant_id)
);
CREATE POLICY "Raters change rating" ON public.dish_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Raters remove rating" ON public.dish_ratings FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Ranked with a small prior (3.5 stars x 2 votes) so one 5-star vote can't top the chart.
CREATE VIEW public.dish_leaderboard WITH (security_invoker = true) AS
  SELECT m.id AS menu_item_id, m.name, m.dish_type, m.photo_url, m.price_cents,
         r.id AS restaurant_id, r.name AS restaurant_name, r.slug AS restaurant_slug, r.neighbourhood,
         count(dr.rating)::integer AS rating_count,
         round(avg(dr.rating)::numeric, 1)::double precision AS avg_rating,
         ((coalesce(sum(dr.rating), 0) + 7.0) / (count(dr.rating) + 2))::double precision AS score
    FROM public.menu_items m
    JOIN public.restaurants r ON r.id = m.restaurant_id AND r.is_active
    JOIN public.dish_ratings dr ON dr.menu_item_id = m.id
   WHERE m.dish_type IS NOT NULL AND NOT m.is_secret
   GROUP BY m.id, r.id;
GRANT SELECT ON public.dish_leaderboard TO anon, authenticated;

-- =====================================================================
-- FOOD CRAWLS (curated by Bite; progress comes from stamps)
-- =====================================================================
CREATE TABLE public.crawls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  emoji text NOT NULL DEFAULT '🗺️',
  cover_url text,
  reward text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.crawl_stops (
  crawl_id uuid NOT NULL REFERENCES public.crawls(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  tip text,
  PRIMARY KEY (crawl_id, restaurant_id)
);
ALTER TABLE public.crawls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_stops ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.crawls, public.crawl_stops TO anon, authenticated;
GRANT ALL ON public.crawls, public.crawl_stops TO service_role;
CREATE POLICY "Crawls are public" ON public.crawls FOR SELECT USING (is_active);
CREATE POLICY "Crawl stops are public" ON public.crawl_stops FOR SELECT USING (true);

-- =====================================================================
-- PAY IT FORWARD: customers buy a meal for someone who needs it
-- =====================================================================
ALTER TABLE public.restaurants ADD COLUMN pay_it_forward boolean NOT NULL DEFAULT false;

CREATE TABLE public.forward_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 100 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  given_at timestamptz
);
CREATE INDEX forward_meals_waiting ON public.forward_meals(restaurant_id) WHERE given_at IS NULL;
ALTER TABLE public.forward_meals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.forward_meals TO authenticated;
GRANT ALL ON public.forward_meals TO service_role;
CREATE POLICY "Read own or restaurant forward meals" ON public.forward_meals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_restaurant(restaurant_id));

CREATE OR REPLACE FUNCTION public.buy_forward(p_restaurant_id uuid, p_label text, p_amount_cents integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.restaurants%ROWTYPE; fid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO r FROM public.restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND OR NOT r.is_active OR NOT r.pay_it_forward THEN RAISE EXCEPTION 'This spot isn''t taking pay-it-forward meals'; END IF;
  INSERT INTO public.forward_meals(restaurant_id, user_id, label, amount_cents)
  VALUES (p_restaurant_id, auth.uid(), left(trim(p_label), 40), p_amount_cents) RETURNING id INTO fid;
  INSERT INTO public.user_badges(user_id, badge_id) SELECT auth.uid(), b.id FROM public.badges b WHERE b.code = 'kind_neighbour' ON CONFLICT DO NOTHING;
  RETURN fid;
END $$;
REVOKE ALL ON FUNCTION public.buy_forward(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_forward(uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.give_forward(p_restaurant_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid; lbl text;
BEGIN
  IF NOT public.owns_restaurant(p_restaurant_id) THEN RAISE EXCEPTION 'Only the owner can do this'; END IF;
  SELECT id, label INTO fid, lbl FROM public.forward_meals WHERE restaurant_id = p_restaurant_id AND given_at IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF fid IS NULL THEN RAISE EXCEPTION 'No meals waiting'; END IF;
  UPDATE public.forward_meals SET given_at = now() WHERE id = fid;
  RETURN lbl;
END $$;
REVOKE ALL ON FUNCTION public.give_forward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.give_forward(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forward_counts()
RETURNS TABLE(restaurant_id uuid, waiting integer, given integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.restaurant_id, count(*) FILTER (WHERE f.given_at IS NULL)::integer, count(*) FILTER (WHERE f.given_at IS NOT NULL)::integer
    FROM public.forward_meals f GROUP BY f.restaurant_id
$$;
GRANT EXECUTE ON FUNCTION public.forward_counts() TO anon, authenticated;

-- =====================================================================
-- FOOD DONATIONS: log unsold food given to a food bank or shelter
-- =====================================================================
CREATE TABLE public.food_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  drop_id uuid REFERENCES public.drops(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  recipient text NOT NULL CHECK (length(recipient) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.food_donations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.food_donations TO authenticated;
GRANT ALL ON public.food_donations TO service_role;
CREATE POLICY "Owners read donations" ON public.food_donations FOR SELECT TO authenticated USING (public.owns_restaurant(restaurant_id));
CREATE POLICY "Owners log donations" ON public.food_donations FOR INSERT TO authenticated WITH CHECK (public.owns_restaurant(restaurant_id));

-- Give whatever is left of a Save-food deal to a food bank and close the deal.
CREATE OR REPLACE FUNCTION public.donate_leftover(p_drop_id uuid, p_recipient text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.drops%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.drops WHERE id = p_drop_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owns_restaurant(d.restaurant_id) THEN RAISE EXCEPTION 'Only the owner can do this'; END IF;
  IF d.quantity_left <= 0 THEN RAISE EXCEPTION 'Nothing left to donate'; END IF;
  INSERT INTO public.food_donations(restaurant_id, drop_id, quantity, recipient)
  VALUES (d.restaurant_id, d.id, d.quantity_left, left(coalesce(nullif(trim(p_recipient), ''), 'Food bank'), 80));
  PERFORM set_config('bite.claiming', 'on', true);
  UPDATE public.drops SET quantity_left = 0, ends_at = greatest(now(), starts_at + interval '1 second') WHERE id = d.id;
  PERFORM set_config('bite.claiming', 'off', true);
  RETURN d.quantity_left;
END $$;
REVOKE ALL ON FUNCTION public.donate_leftover(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donate_leftover(uuid, text) TO authenticated;

-- City-wide impact numbers (no personal data).
CREATE OR REPLACE FUNCTION public.city_impact()
RETURNS TABLE(meals_rescued integer, meals_donated integer, meals_paid_forward integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::integer FROM public.orders o JOIN public.drops d ON d.id = o.drop_id WHERE d.kind = 'leftover' AND o.status <> 'cancelled'),
    (SELECT coalesce(sum(quantity), 0)::integer FROM public.food_donations),
    (SELECT count(*)::integer FROM public.forward_meals)
$$;
GRANT EXECUTE ON FUNCTION public.city_impact() TO anon, authenticated;

-- =====================================================================
-- TASTE TWINS: anonymous picks from people who eat where you eat
-- =====================================================================
CREATE OR REPLACE FUNCTION public.taste_twin_picks()
RETURNS TABLE(restaurant_id uuid, twins integer, score integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (SELECT DISTINCT s.restaurant_id FROM public.stamps s WHERE s.user_id = auth.uid()),
  twin AS (
    SELECT s.user_id, count(DISTINCT s.restaurant_id)::integer AS overlap
      FROM public.stamps s JOIN mine m ON m.restaurant_id = s.restaurant_id
     WHERE s.user_id <> auth.uid()
     GROUP BY s.user_id
  )
  SELECT s.restaurant_id, count(DISTINCT s.user_id)::integer, sum(t.overlap)::integer
    FROM public.stamps s JOIN twin t ON t.user_id = s.user_id
    JOIN public.restaurants r ON r.id = s.restaurant_id AND r.is_active
   WHERE s.restaurant_id NOT IN (SELECT restaurant_id FROM mine)
   GROUP BY s.restaurant_id
  HAVING count(DISTINCT s.user_id) >= 2   -- never reveal one person's habits
   ORDER BY 3 DESC, 2 DESC
   LIMIT 10
$$;
REVOKE ALL ON FUNCTION public.taste_twin_picks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taste_twin_picks() TO authenticated;

-- =====================================================================
-- BADGES: Crawl Champ and Kind Neighbour
-- =====================================================================
INSERT INTO public.badges(code, name, description, icon) VALUES
  ('crawler', 'Crawl Champ', 'Finish a food crawl', '🏁'),
  ('kind_neighbour', 'Kind Neighbour', 'Pay a meal forward', '💛')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.award_badges(_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total integer; spots integer; coffee integer; hoods integer; best integer; drops integer; rescued integer; reviews integer; crawled boolean;
BEGIN
  SELECT count(*), count(DISTINCT s.restaurant_id),
         count(DISTINCT s.restaurant_id) FILTER (WHERE r.category = 'Coffee'),
         count(DISTINCT r.neighbourhood),
         count(*) FILTER (WHERE s.source = 'drop')
    INTO total, spots, coffee, hoods, drops
    FROM public.stamps s JOIN public.restaurants r ON r.id = s.restaurant_id
   WHERE s.user_id = _user;
  SELECT coalesce(max(c), 0) INTO best FROM (SELECT count(*) c FROM public.stamps WHERE user_id = _user GROUP BY restaurant_id) x;
  SELECT count(*) INTO rescued FROM public.stamps s JOIN public.orders o ON o.id = s.order_id JOIN public.drops d ON d.id = o.drop_id
   WHERE s.user_id = _user AND d.kind = 'leftover';
  SELECT count(*) INTO reviews FROM public.reviews WHERE user_id = _user;
  SELECT EXISTS (
    SELECT 1 FROM public.crawls c WHERE c.is_active
       AND EXISTS (SELECT 1 FROM public.crawl_stops cs WHERE cs.crawl_id = c.id)
       AND NOT EXISTS (
         SELECT 1 FROM public.crawl_stops cs WHERE cs.crawl_id = c.id
            AND NOT EXISTS (SELECT 1 FROM public.stamps s WHERE s.user_id = _user AND s.restaurant_id = cs.restaurant_id))
  ) INTO crawled;
  INSERT INTO public.user_badges(user_id, badge_id)
  SELECT _user, b.id FROM public.badges b
   WHERE (b.code = 'first_stamp' AND total >= 1)
      OR (b.code = 'coffee_crawler' AND coffee >= 5)
      OR (b.code = 'neighbourhood_hopper' AND hoods >= 4)
      OR (b.code = 'regular' AND best >= 5)
      OR (b.code = 'drop_hunter' AND drops >= 3)
      OR (b.code = 'explorer' AND spots >= 10)
      OR (b.code = 'maple_level' AND total >= 30)
      OR (b.code = 'food_saver' AND rescued >= 5)
      OR (b.code = 'critic' AND reviews >= 5)
      OR (b.code = 'crawler' AND crawled)
  ON CONFLICT DO NOTHING;
END $$;
