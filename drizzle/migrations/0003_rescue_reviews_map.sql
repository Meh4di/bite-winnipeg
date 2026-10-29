-- =====================================================================
-- FOOD RESCUE: last-call deals must be at least 50% off
-- =====================================================================
ALTER TABLE public.drops ADD CONSTRAINT drops_leftover_discount_ok CHECK (
  kind <> 'leftover' OR (original_price_cents IS NOT NULL AND original_price_cents > 0 AND price_cents * 2 <= original_price_cents)
) NOT VALID;

INSERT INTO public.badges(code, name, description, icon) VALUES
  ('food_saver', 'Food Saver', 'Rescue 5 meals with last-call deals', '♻️'),
  ('critic', 'Local Critic', 'Write 5 reviews', '📝')
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- HOUSE SPECIAL: one featured dish per restaurant
-- =====================================================================
ALTER TABLE public.menu_items ADD COLUMN is_house_special boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX menu_items_one_house_special ON public.menu_items(restaurant_id) WHERE is_house_special;

-- =====================================================================
-- LIVE BUSYNESS + FREE FIRST 3 MONTHS
-- =====================================================================
ALTER TABLE public.restaurants
  ADD COLUMN busy_level text CHECK (busy_level IN ('quiet', 'steady', 'busy', 'packed')),
  ADD COLUMN wait_minutes integer CHECK (wait_minutes BETWEEN 0 AND 240),
  ADD COLUMN busy_updated_at timestamptz,
  ADD COLUMN free_until timestamptz;
UPDATE public.restaurants SET free_until = greatest(created_at, now()) + interval '3 months' WHERE free_until IS NULL;
ALTER TABLE public.restaurants ALTER COLUMN free_until SET DEFAULT (now() + interval '3 months');

-- Owners can update their own row, but not their free period; busy updates get a timestamp.
CREATE OR REPLACE FUNCTION public.restaurants_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.free_until := now() + interval '3 months';
    ELSIF NEW.free_until IS DISTINCT FROM OLD.free_until THEN
      NEW.free_until := OLD.free_until;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.busy_level IS DISTINCT FROM OLD.busy_level OR NEW.wait_minutes IS DISTINCT FROM OLD.wait_minutes THEN
    NEW.busy_updated_at := CASE WHEN NEW.busy_level IS NULL AND NEW.wait_minutes IS NULL THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER restaurants_guard BEFORE INSERT OR UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.restaurants_guard();

-- How many pickup orders each kitchen is working on right now (no personal data).
CREATE OR REPLACE FUNCTION public.live_queue()
RETURNS TABLE(restaurant_id uuid, active_orders integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.restaurant_id, count(*)::integer FROM public.orders o
   WHERE o.status IN ('paid', 'preparing') AND o.created_at > now() - interval '12 hours'
   GROUP BY o.restaurant_id
$$;
GRANT EXECUTE ON FUNCTION public.live_queue() TO anon, authenticated;

-- =====================================================================
-- PHOTO REVIEWS (verified: you must have a stamp at the spot)
-- =====================================================================
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT 'Foodie',
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 1000),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 8),
  photo_urls text[] NOT NULL DEFAULT '{}' CHECK (cardinality(photo_urls) <= 4),
  owner_reply text CHECK (length(owner_reply) <= 600),
  owner_replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);
CREATE INDEX reviews_restaurant_created ON public.reviews(restaurant_id, created_at DESC);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT (restaurant_id, rating, body, tags, photo_urls) ON public.reviews TO authenticated;
GRANT UPDATE (rating, body, tags, photo_urls) ON public.reviews TO authenticated;
GRANT DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
CREATE POLICY "Reviews are public" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Verified visitors review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND NOT public.owns_restaurant(restaurant_id)
  AND EXISTS (SELECT 1 FROM public.stamps s WHERE s.user_id = auth.uid() AND s.restaurant_id = reviews.restaurant_id)
);
CREATE POLICY "Authors edit reviews" ON public.reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authors delete reviews" ON public.reviews FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reviews_fill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Foodie') INTO NEW.author_name FROM public.profiles WHERE id = NEW.user_id;
    NEW.author_name := coalesce(NEW.author_name, 'Foodie');
  END IF;
  NEW.tags := ARRAY(SELECT DISTINCT t FROM unnest(NEW.tags) t WHERE t = ANY (ARRAY[
    'Great food','Great value','Friendly staff','Fast','Cozy vibe','Big portions',
    'Pricey','Slow','Small portions','Cold food','Too loud','Messed up order']));
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER reviews_fill BEFORE INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.reviews_fill();

CREATE OR REPLACE FUNCTION public.reply_to_review(p_review_id uuid, p_reply text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  SELECT restaurant_id INTO rid FROM public.reviews WHERE id = p_review_id;
  IF rid IS NULL OR NOT public.owns_restaurant(rid) THEN RAISE EXCEPTION 'Only the owner can reply'; END IF;
  IF length(coalesce(p_reply, '')) > 600 THEN RAISE EXCEPTION 'Replies are 600 characters max'; END IF;
  UPDATE public.reviews SET owner_reply = nullif(trim(p_reply), ''),
    owner_replied_at = CASE WHEN nullif(trim(p_reply), '') IS NULL THEN NULL ELSE now() END
   WHERE id = p_review_id;
END $$;
REVOKE ALL ON FUNCTION public.reply_to_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_review(uuid, text) TO authenticated;

CREATE TABLE public.review_reports (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
GRANT INSERT (review_id, reason) ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;
CREATE POLICY "Users report" ON public.review_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE VIEW public.restaurant_ratings WITH (security_invoker = true) AS
  SELECT restaurant_id, round(avg(rating)::numeric, 1)::double precision AS avg_rating, count(*)::integer AS review_count
    FROM public.reviews GROUP BY restaurant_id;
GRANT SELECT ON public.restaurant_ratings TO anon, authenticated;

-- Review photos bucket: anyone can view, signed-in users upload to their own folder.
INSERT INTO storage.buckets (id, name, public) VALUES ('review-photos', 'review-photos', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Review photos read" ON storage.objects FOR SELECT USING (bucket_id = 'review-photos');
CREATE POLICY "Review photos upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Review photos delete own" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- BADGES: add Food Saver and Local Critic
-- =====================================================================
CREATE OR REPLACE FUNCTION public.award_badges(_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total integer; spots integer; coffee integer; hoods integer; best integer; drops integer; rescued integer; reviews integer;
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
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.reviews_award_badges() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.award_badges(NEW.user_id); RETURN NEW; END $$;
CREATE TRIGGER reviews_award_badges AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.reviews_award_badges();
