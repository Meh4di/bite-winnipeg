-- Bity Map: community "best of" votes, a heat score for where Winnipeg is eating,
-- privacy-safe interest counts (views / directions taps), and the owner's "Bity sent you" report.

-- ---------- votes: one pick per person per category ----------
CREATE TABLE public.spot_votes (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  category text NOT NULL CHECK (category IN
    ('smash-burger', 'pizza', 'tacos', 'noodles', 'coffee', 'bakery', 'brunch', 'ice-cream', 'drinks')),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);
CREATE INDEX spot_votes_category ON public.spot_votes (category, restaurant_id);
ALTER TABLE public.spot_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spot_votes FROM anon, authenticated;
GRANT SELECT ON public.spot_votes TO authenticated;
GRANT ALL ON public.spot_votes TO service_role;
CREATE POLICY "See own votes" ON public.spot_votes FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.vote_spot(p_category text, p_restaurant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.restaurants;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  SELECT * INTO r FROM public.restaurants WHERE id = p_restaurant_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pick a spot on Bity'; END IF;
  IF r.owner_id = auth.uid() THEN RAISE EXCEPTION 'You can''t vote for your own restaurant'; END IF;
  IF r.is_sample THEN RAISE EXCEPTION 'That''s a sample spot. Vote for a real one!'; END IF;
  INSERT INTO public.spot_votes (user_id, category, restaurant_id) VALUES (auth.uid(), p_category, p_restaurant_id)
  ON CONFLICT (user_id, category) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.vote_spot(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_spot(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_vote(p_category text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.spot_votes WHERE user_id = auth.uid() AND category = p_category
$$;
REVOKE ALL ON FUNCTION public.clear_vote(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_vote(text) TO authenticated;

-- Leaderboard: a vote from someone who has actually been there (has a stamp) counts double.
CREATE OR REPLACE FUNCTION public.best_spots(p_category text)
RETURNS TABLE (restaurant_id uuid, votes integer, verified integer, score integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.restaurant_id,
         count(*)::integer,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.stamps s WHERE s.user_id = v.user_id AND s.restaurant_id = v.restaurant_id))::integer,
         (count(*) + count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.stamps s WHERE s.user_id = v.user_id AND s.restaurant_id = v.restaurant_id)))::integer
    FROM public.spot_votes v
    JOIN public.restaurants r ON r.id = v.restaurant_id AND r.is_active
   WHERE v.category = p_category
   GROUP BY v.restaurant_id
   ORDER BY 4 DESC, 2 DESC
   LIMIT 10
$$;
GRANT EXECUTE ON FUNCTION public.best_spots(text) TO anon, authenticated;

-- ---------- interest events (no location tracking; just taps inside Bity) ----------
CREATE TABLE public.spot_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('view', 'directions')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spot_events_lookup ON public.spot_events (restaurant_id, kind, created_at DESC);
ALTER TABLE public.spot_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spot_events FROM anon, authenticated;
GRANT ALL ON public.spot_events TO service_role;

-- Counted once per person per spot per hour, so refreshing can't inflate numbers.
CREATE OR REPLACE FUNCTION public.log_spot_event(p_restaurant_id uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_kind NOT IN ('view', 'directions') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid()) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.spot_events WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid()
               AND kind = p_kind AND created_at > now() - interval '1 hour') THEN RETURN; END IF;
  INSERT INTO public.spot_events (restaurant_id, user_id, kind) VALUES (p_restaurant_id, auth.uid(), p_kind);
END $$;
REVOKE ALL ON FUNCTION public.log_spot_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_spot_event(uuid, text) TO authenticated;

-- ---------- heat: where Winnipeg is eating this week ----------
CREATE OR REPLACE FUNCTION public.map_heat()
RETURNS TABLE (restaurant_id uuid, heat integer, visits_week integer, reviews integer, hot_item text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT id FROM public.restaurants WHERE is_active),
  st AS (SELECT restaurant_id, count(*) n FROM public.stamps WHERE created_at > now() - interval '7 days' GROUP BY 1),
  od AS (SELECT restaurant_id, count(*) n FROM public.orders WHERE created_at > now() - interval '7 days' GROUP BY 1),
  rv7 AS (SELECT restaurant_id, count(*) n FROM public.reviews WHERE created_at > now() - interval '7 days' GROUP BY 1),
  rv AS (SELECT restaurant_id, count(*) n FROM public.reviews GROUP BY 1),
  pl AS (SELECT d.restaurant_id, count(*) n FROM public.unlock_pledges p JOIN public.unlock_deals d ON d.id = p.deal_id
          WHERE p.created_at > now() - interval '7 days' GROUP BY 1),
  ev AS (SELECT restaurant_id, count(*) FILTER (WHERE kind = 'directions') dir, count(*) FILTER (WHERE kind = 'view') vw
           FROM public.spot_events WHERE created_at > now() - interval '7 days' GROUP BY 1),
  vt AS (SELECT restaurant_id, count(*) n FROM public.spot_votes GROUP BY 1),
  hot AS (
    SELECT DISTINCT ON (mi.restaurant_id) mi.restaurant_id, mi.name
      FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      JOIN public.menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.created_at > now() - interval '30 days' AND NOT mi.is_secret
     GROUP BY mi.restaurant_id, mi.id, mi.name
     ORDER BY mi.restaurant_id, sum(oi.quantity) DESC
  )
  SELECT r.id,
         (3 * coalesce(st.n, 0) + 3 * coalesce(od.n, 0) + 2 * coalesce(rv7.n, 0) + coalesce(pl.n, 0)
          + coalesce(ev.dir, 0) + coalesce(vt.n, 0) + (coalesce(ev.vw, 0) / 5))::integer,
         (coalesce(st.n, 0) + coalesce(od.n, 0))::integer,
         coalesce(rv.n, 0)::integer,
         hot.name
    FROM r
    LEFT JOIN st ON st.restaurant_id = r.id LEFT JOIN od ON od.restaurant_id = r.id
    LEFT JOIN rv7 ON rv7.restaurant_id = r.id LEFT JOIN rv ON rv.restaurant_id = r.id
    LEFT JOIN pl ON pl.restaurant_id = r.id LEFT JOIN ev ON ev.restaurant_id = r.id
    LEFT JOIN vt ON vt.restaurant_id = r.id LEFT JOIN hot ON hot.restaurant_id = r.id
$$;
GRANT EXECUTE ON FUNCTION public.map_heat() TO anon, authenticated;

-- ---------- owner report: what Bity sent you ----------
CREATE OR REPLACE FUNCTION public.owner_report(p_restaurant_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (views integer, directions integer, verified_visits integer, pickups integer, redemptions integer,
               new_followers integer, votes integer, best_rank text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  rank_txt text;
BEGIN
  IF NOT public.owns_restaurant(p_restaurant_id) AND NOT public.is_admin() THEN RAISE EXCEPTION 'Only the owner can see this'; END IF;
  SELECT string_agg(format('#%s %s', x.rnk, x.category), ', ' ORDER BY x.rnk) INTO rank_txt FROM (
    SELECT c.category, c.restaurant_id, rank() OVER (PARTITION BY c.category ORDER BY c.score DESC) rnk
      FROM (SELECT v.category, v.restaurant_id,
                   count(*) + count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.stamps s WHERE s.user_id = v.user_id AND s.restaurant_id = v.restaurant_id)) score
              FROM public.spot_votes v GROUP BY 1, 2) c
  ) x WHERE x.restaurant_id = p_restaurant_id AND x.rnk <= 3;
  RETURN QUERY SELECT
    (SELECT count(*)::integer FROM public.spot_events WHERE restaurant_id = p_restaurant_id AND kind = 'view' AND created_at > since),
    (SELECT count(*)::integer FROM public.spot_events WHERE restaurant_id = p_restaurant_id AND kind = 'directions' AND created_at > since),
    (SELECT count(*)::integer FROM public.stamps WHERE restaurant_id = p_restaurant_id AND source = 'visit' AND created_at > since),
    (SELECT count(*)::integer FROM public.orders WHERE restaurant_id = p_restaurant_id AND status = 'picked_up' AND created_at > since),
    (SELECT count(*)::integer FROM public.unlock_pledges p JOIN public.unlock_deals d ON d.id = p.deal_id
      WHERE d.restaurant_id = p_restaurant_id AND p.redeemed_at > since),
    (SELECT count(*)::integer FROM public.follows WHERE restaurant_id = p_restaurant_id AND created_at > since),
    (SELECT count(*)::integer FROM public.spot_votes WHERE restaurant_id = p_restaurant_id),
    rank_txt;
END $$;
REVOKE ALL ON FUNCTION public.owner_report(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_report(uuid, integer) TO authenticated;

-- ---------- admin: fill in map pins for listings ----------
CREATE OR REPLACE FUNCTION public.admin_set_location(p_restaurant_id uuid, p_lat double precision, p_lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  -- Keep pins inside the Winnipeg area so a bad lookup can't drop a spot in another city.
  IF p_lat NOT BETWEEN 49.70 AND 50.05 OR p_lng NOT BETWEEN -97.45 AND -96.85 THEN
    RAISE EXCEPTION 'That location is outside Winnipeg';
  END IF;
  UPDATE public.restaurants SET lat = p_lat, lng = p_lng WHERE id = p_restaurant_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_location(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_location(uuid, double precision, double precision) TO authenticated;
