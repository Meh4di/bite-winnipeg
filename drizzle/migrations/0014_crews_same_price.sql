-- Bring your crew: an unlock deal that switches on for YOUR group as soon as it's full.
-- No waiting on strangers: each crew unlocks on its own. Classic unlock deals (crew_size NULL) are unchanged.
-- Plus the "Same price as in-store" pledge restaurants can make.

-- ---------- same price pledge ----------
ALTER TABLE public.restaurants ADD COLUMN same_price_pledge boolean NOT NULL DEFAULT false;

-- ---------- crew deals ----------
ALTER TABLE public.unlock_deals
  ADD COLUMN crew_size integer CHECK (crew_size IS NULL OR crew_size BETWEEN 2 AND 8),
  ADD CONSTRAINT unlock_deals_crew_goal CHECK (crew_size IS NULL OR goal = crew_size);
GRANT INSERT (crew_size) ON public.unlock_deals TO authenticated;

-- crew_id is a random id shared by everyone in one crew (never a pledge id, so the
-- invite link can't reveal anyone's pickup code). crew_leader marks who started it.
ALTER TABLE public.unlock_pledges
  ADD COLUMN crew_id uuid,
  ADD COLUMN crew_leader boolean NOT NULL DEFAULT false;
CREATE INDEX unlock_pledges_crew ON public.unlock_pledges (crew_id) WHERE crew_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.crew_count(_crew uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.unlock_pledges WHERE crew_id = _crew
$$;
REVOKE ALL ON FUNCTION public.crew_count(uuid) FROM PUBLIC, anon, authenticated;

-- Has this pledge's deal switched on for this person?
CREATE OR REPLACE FUNCTION public.pledge_unlocked(_pledge uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN d.crew_size IS NULL
              THEN (SELECT count(*) FROM public.unlock_pledges x WHERE x.deal_id = d.id) >= d.goal
              ELSE public.crew_count(p.crew_id) >= d.crew_size END
    FROM public.unlock_pledges p JOIN public.unlock_deals d ON d.id = p.deal_id
   WHERE p.id = _pledge
$$;
REVOKE ALL ON FUNCTION public.pledge_unlocked(uuid) FROM PUBLIC, anon, authenticated;

DROP FUNCTION public.unlock_progress();
CREATE FUNCTION public.unlock_progress()
RETURNS TABLE (deal_id uuid, joined integer, mine boolean, my_code text, redeemed boolean,
               my_crew uuid, crew_joined integer, i_lead boolean, crews_unlocked integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id,
         (SELECT count(*)::integer FROM public.unlock_pledges p WHERE p.deal_id = d.id),
         me.id IS NOT NULL,
         CASE WHEN me.id IS NOT NULL THEN public.unlock_code(me.id) END,
         coalesce(me.redeemed_at IS NOT NULL, false),
         me.crew_id,
         CASE WHEN me.crew_id IS NOT NULL THEN public.crew_count(me.crew_id) END,
         coalesce(me.crew_leader, false),
         CASE WHEN d.crew_size IS NOT NULL THEN
           (SELECT count(*)::integer FROM (
              SELECT p.crew_id FROM public.unlock_pledges p WHERE p.deal_id = d.id
               GROUP BY p.crew_id HAVING count(*) >= d.crew_size) c)
         END
    FROM public.unlock_deals d
    JOIN public.restaurants r ON r.id = d.restaurant_id
    LEFT JOIN public.unlock_pledges me ON me.deal_id = d.id AND me.user_id = auth.uid()
   WHERE (r.is_active OR r.owner_id = auth.uid())
     AND d.pickup_until > now() - interval '1 day'
$$;
GRANT EXECUTE ON FUNCTION public.unlock_progress() TO anon, authenticated;

-- Join a deal. For crew deals: no p_crew starts a new crew, p_crew joins that crew.
DROP FUNCTION public.join_unlock(uuid);
CREATE FUNCTION public.join_unlock(p_deal_id uuid, p_crew uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.unlock_deals; n integer; crew uuid; lead boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join'; END IF;
  SELECT * INTO d FROM public.unlock_deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND OR d.cancelled OR NOT public.is_verified_restaurant(d.restaurant_id) THEN RAISE EXCEPTION 'This deal isn''t available'; END IF;
  IF d.ends_at <= now() THEN RAISE EXCEPTION 'This deal has closed'; END IF;
  IF public.owns_restaurant(d.restaurant_id) THEN RAISE EXCEPTION 'You can''t join your own deal'; END IF;
  IF EXISTS (SELECT 1 FROM public.unlock_pledges WHERE deal_id = d.id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You''ve already joined this deal';
  END IF;
  SELECT count(*) INTO n FROM public.unlock_pledges WHERE deal_id = d.id;
  IF n >= d.max_spots THEN RAISE EXCEPTION 'All spots are taken'; END IF;

  IF d.crew_size IS NOT NULL THEN
    IF p_crew IS NULL THEN
      crew := gen_random_uuid(); lead := true;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.unlock_pledges WHERE deal_id = d.id AND crew_id = p_crew) THEN
        RAISE EXCEPTION 'That crew link isn''t valid for this deal';
      END IF;
      IF public.crew_count(p_crew) >= 8 THEN RAISE EXCEPTION 'This crew is full (8 max). Start your own!'; END IF;
      crew := p_crew;
    END IF;
  END IF;

  INSERT INTO public.unlock_pledges (deal_id, user_id, crew_id, crew_leader) VALUES (d.id, auth.uid(), crew, lead);
  INSERT INTO public.activity (user_id, kind, restaurant_id) VALUES (auth.uid(), 'unlock', d.restaurant_id);
  IF crew IS NOT NULL THEN RETURN public.crew_count(crew); END IF;
  RETURN n + 1;
END $$;
REVOKE ALL ON FUNCTION public.join_unlock(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_unlock(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_unlock(p_deal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.unlock_deals; me public.unlock_pledges; n integer;
BEGIN
  SELECT * INTO d FROM public.unlock_deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF d.ends_at <= now() THEN RAISE EXCEPTION 'This deal has closed'; END IF;
  SELECT * INTO me FROM public.unlock_pledges WHERE deal_id = d.id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN; END IF;
  IF public.pledge_unlocked(me.id) THEN
    RAISE EXCEPTION 'This deal is already unlocked, so your spot is locked in. Contact the restaurant if you can''t make it.';
  END IF;
  IF me.crew_leader AND public.crew_count(me.crew_id) > 1 THEN
    RAISE EXCEPTION 'Your crew is counting on you. Ask them to leave first, or keep your spot.';
  END IF;
  DELETE FROM public.unlock_pledges WHERE id = me.id;
  DELETE FROM public.activity WHERE id = (
    SELECT id FROM public.activity WHERE user_id = auth.uid() AND kind = 'unlock' AND restaurant_id = d.restaurant_id
     ORDER BY created_at DESC LIMIT 1);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_unlock(p_pledge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.unlock_deals;
BEGIN
  SELECT dl.* INTO d FROM public.unlock_pledges p JOIN public.unlock_deals dl ON dl.id = p.deal_id WHERE p.id = p_pledge_id;
  IF NOT FOUND OR NOT public.owns_restaurant(d.restaurant_id) THEN RAISE EXCEPTION 'Only the restaurant can do this'; END IF;
  IF NOT public.pledge_unlocked(p_pledge_id) THEN RAISE EXCEPTION 'This deal hasn''t unlocked'; END IF;
  IF now() > d.pickup_until THEN RAISE EXCEPTION 'The pickup window is over'; END IF;
  UPDATE public.unlock_pledges SET redeemed_at = coalesce(redeemed_at, now()) WHERE id = p_pledge_id;
END $$;

-- Owner's list now says which crew each person is in and whether their deal is on.
DROP FUNCTION public.unlock_pledge_list(uuid);
CREATE FUNCTION public.unlock_pledge_list(p_deal_id uuid)
RETURNS TABLE (pledge_id uuid, code text, first_name text, redeemed_at timestamptz, created_at timestamptz,
               crew text, unlocked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unlock_deals d WHERE d.id = p_deal_id AND public.owns_restaurant(d.restaurant_id)) THEN
    RAISE EXCEPTION 'Only the restaurant can see this';
  END IF;
  RETURN QUERY
    SELECT p.id, public.unlock_code(p.id),
           coalesce(nullif(split_part(trim(pr.full_name), ' ', 1), ''), 'Guest'), p.redeemed_at, p.created_at,
           CASE WHEN p.crew_id IS NOT NULL THEN
             (SELECT coalesce(nullif(split_part(trim(lp.full_name), ' ', 1), ''), 'Guest') || '''s crew'
                FROM public.unlock_pledges l LEFT JOIN public.profiles lp ON lp.id = l.user_id
               WHERE l.crew_id = p.crew_id AND l.crew_leader LIMIT 1)
           END,
           public.pledge_unlocked(p.id)
      FROM public.unlock_pledges p LEFT JOIN public.profiles pr ON pr.id = p.user_id
     WHERE p.deal_id = p_deal_id
     ORDER BY p.crew_id NULLS FIRST, p.created_at;
END $$;
REVOKE ALL ON FUNCTION public.unlock_pledge_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_pledge_list(uuid) TO authenticated;

-- Who's in my crew (first names only), for crew members.
CREATE OR REPLACE FUNCTION public.my_crew(p_deal_id uuid)
RETURNS TABLE (first_name text, avatar_url text, is_leader boolean, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(split_part(trim(pr.full_name), ' ', 1), ''), 'Guest'), pr.avatar_url, p.crew_leader, p.user_id = auth.uid()
    FROM public.unlock_pledges me
    JOIN public.unlock_pledges p ON p.crew_id = me.crew_id
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
   WHERE me.deal_id = p_deal_id AND me.user_id = auth.uid() AND me.crew_id IS NOT NULL
   ORDER BY p.crew_leader DESC, p.created_at
$$;
REVOKE ALL ON FUNCTION public.my_crew(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_crew(uuid) TO authenticated;

-- Invite landing: who started this crew and how many are in (first name only).
CREATE OR REPLACE FUNCTION public.crew_invite(p_deal_id uuid, p_crew uuid)
RETURNS TABLE (leader_name text, members integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(split_part(trim(pr.full_name), ' ', 1), ''), 'A friend'), public.crew_count(p_crew)
    FROM public.unlock_pledges l LEFT JOIN public.profiles pr ON pr.id = l.user_id
   WHERE l.deal_id = p_deal_id AND l.crew_id = p_crew AND l.crew_leader
$$;
GRANT EXECUTE ON FUNCTION public.crew_invite(uuid, uuid) TO anon, authenticated;
