-- =====================================================================
-- SOCIAL: handles, privacy, follows, blocks, activity feed, Taste Match,
-- and "Table for 4" group meetups. Safety first:
--   * meetups are 18+, groups of 3+ people, always at a restaurant on Bite
--   * blocking hides people from each other everywhere
--   * friends see activity only after an hour, so nobody knows where you are right now
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN username text UNIQUE CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  ADD COLUMN bio text CHECK (length(bio) <= 160),
  ADD COLUMN discoverable boolean NOT NULL DEFAULT false,
  ADD COLUMN share_activity boolean NOT NULL DEFAULT true;

-- Birth date is private: only its owner can read it.
CREATE TABLE public.profile_private (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  birth_date date NOT NULL CHECK (birth_date > '1900-01-01'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_private FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;
CREATE POLICY "Own private profile" ON public.profile_private FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_adult(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profile_private WHERE user_id = _user AND birth_date <= (current_date - interval '18 years'))
$$;
GRANT EXECUTE ON FUNCTION public.is_adult(uuid) TO authenticated;

-- ---------- blocks ----------
CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL DEFAULT auth.uid(),
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_blocks FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
CREATE POLICY "Own blocks" ON public.user_blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.blocked_between(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a))
$$;

-- ---------- follows ----------
CREATE TABLE public.user_follows (
  follower_id uuid NOT NULL DEFAULT auth.uid(),
  followee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX user_follows_followee ON public.user_follows(followee_id);
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_follows FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;
GRANT ALL ON public.user_follows TO service_role;
CREATE POLICY "See own follow edges" ON public.user_follows FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR followee_id = auth.uid());
CREATE POLICY "Follow people" ON public.user_follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid() AND NOT public.blocked_between(auth.uid(), followee_id));
CREATE POLICY "Unfollow" ON public.user_follows FOR DELETE TO authenticated USING (follower_id = auth.uid() OR followee_id = auth.uid());

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_follows WHERE follower_id = _a AND followee_id = _b)
     AND EXISTS (SELECT 1 FROM public.user_follows WHERE follower_id = _b AND followee_id = _a)
$$;

-- Blocking someone also removes follows both ways.
CREATE OR REPLACE FUNCTION public.user_blocks_cleanup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.user_follows WHERE (follower_id = NEW.blocker_id AND followee_id = NEW.blocked_id) OR (follower_id = NEW.blocked_id AND followee_id = NEW.blocker_id);
  RETURN NEW;
END $$;
CREATE TRIGGER user_blocks_cleanup AFTER INSERT ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION public.user_blocks_cleanup();

-- Public counts and relationship for a profile page.
CREATE OR REPLACE FUNCTION public.social_summary(p_user uuid)
RETURNS TABLE(followers integer, following integer, i_follow boolean, follows_me boolean, blocked boolean, stamps integer, spots integer, badges integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::integer FROM public.user_follows WHERE followee_id = p_user),
    (SELECT count(*)::integer FROM public.user_follows WHERE follower_id = p_user),
    EXISTS (SELECT 1 FROM public.user_follows WHERE follower_id = auth.uid() AND followee_id = p_user),
    EXISTS (SELECT 1 FROM public.user_follows WHERE follower_id = p_user AND followee_id = auth.uid()),
    public.blocked_between(auth.uid(), p_user),
    (SELECT count(*)::integer FROM public.stamps WHERE user_id = p_user),
    (SELECT count(DISTINCT restaurant_id)::integer FROM public.stamps WHERE user_id = p_user),
    (SELECT count(*)::integer FROM public.user_badges WHERE user_id = p_user)
$$;
REVOKE ALL ON FUNCTION public.social_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_summary(uuid) TO authenticated;

-- ---------- activity feed ----------
CREATE TABLE public.activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('stamp', 'rescue', 'review', 'badge', 'forward', 'table')),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  badge_id uuid REFERENCES public.badges(id) ON DELETE CASCADE,
  rating smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_user_created ON public.activity(user_id, created_at DESC);
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity FROM anon, authenticated;
GRANT SELECT ON public.activity TO authenticated;
GRANT ALL ON public.activity TO service_role;

CREATE OR REPLACE FUNCTION public.can_see_activity(_owner uuid, _at timestamptz) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner = auth.uid() OR (
    public.are_friends(auth.uid(), _owner)
    AND NOT public.blocked_between(auth.uid(), _owner)
    AND coalesce((SELECT share_activity FROM public.profiles WHERE id = _owner), true)
    AND _at < now() - interval '1 hour'
  )
$$;
CREATE POLICY "Friends see activity (after an hour)" ON public.activity FOR SELECT TO authenticated
  USING (public.can_see_activity(user_id, created_at));

CREATE TABLE public.activity_reactions (
  activity_id uuid NOT NULL REFERENCES public.activity(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);
ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_reactions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.activity_reactions TO authenticated;
GRANT ALL ON public.activity_reactions TO service_role;
CREATE POLICY "See reactions on visible activity" ON public.activity_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.activity a WHERE a.id = activity_id AND public.can_see_activity(a.user_id, a.created_at)));
CREATE POLICY "React to visible activity" ON public.activity_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.activity a WHERE a.id = activity_id AND public.can_see_activity(a.user_id, a.created_at)));
CREATE POLICY "Remove own reaction" ON public.activity_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Feed items are written by triggers, never by clients.
CREATE OR REPLACE FUNCTION public.activity_from_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text := 'stamp';
BEGIN
  IF NEW.order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders o JOIN public.drops d ON d.id = o.drop_id WHERE o.id = NEW.order_id AND d.kind = 'leftover') THEN
    k := 'rescue';
  END IF;
  INSERT INTO public.activity(user_id, kind, restaurant_id, created_at) VALUES (NEW.user_id, k, NEW.restaurant_id, NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER activity_from_stamp AFTER INSERT ON public.stamps FOR EACH ROW EXECUTE FUNCTION public.activity_from_stamp();

CREATE OR REPLACE FUNCTION public.activity_from_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity(user_id, kind, restaurant_id, rating, created_at) VALUES (NEW.user_id, 'review', NEW.restaurant_id, NEW.rating, NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER activity_from_review AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.activity_from_review();

CREATE OR REPLACE FUNCTION public.activity_from_badge() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity(user_id, kind, badge_id, created_at) VALUES (NEW.user_id, 'badge', NEW.badge_id, NEW.earned_at);
  RETURN NEW;
END $$;
CREATE TRIGGER activity_from_badge AFTER INSERT ON public.user_badges FOR EACH ROW EXECUTE FUNCTION public.activity_from_badge();

CREATE OR REPLACE FUNCTION public.activity_from_forward() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity(user_id, kind, restaurant_id, created_at) VALUES (NEW.user_id, 'forward', NEW.restaurant_id, NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER activity_from_forward AFTER INSERT ON public.forward_meals FOR EACH ROW EXECUTE FUNCTION public.activity_from_forward();

-- ---------- Taste Match ----------
-- 50% shared spots (Jaccard) + 50% similar taste in food types (cosine), 0-100.
CREATE OR REPLACE FUNCTION public._taste_score(_a uuid, _b uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ra AS (SELECT DISTINCT restaurant_id FROM public.stamps WHERE user_id = _a),
       rb AS (SELECT DISTINCT restaurant_id FROM public.stamps WHERE user_id = _b),
       ca AS (SELECT r.category, count(*)::float n FROM public.stamps s JOIN public.restaurants r ON r.id = s.restaurant_id WHERE s.user_id = _a GROUP BY 1),
       cb AS (SELECT r.category, count(*)::float n FROM public.stamps s JOIN public.restaurants r ON r.id = s.restaurant_id WHERE s.user_id = _b GROUP BY 1),
       j AS (SELECT (SELECT count(*) FROM ra JOIN rb USING (restaurant_id))::float
                    / nullif((SELECT count(*) FROM (SELECT restaurant_id FROM ra UNION SELECT restaurant_id FROM rb) u), 0) AS v),
       c AS (SELECT coalesce((SELECT sum(ca.n * cb.n) FROM ca JOIN cb USING (category)), 0)
                    / nullif(sqrt((SELECT sum(n * n) FROM ca)) * sqrt((SELECT sum(n * n) FROM cb)), 0) AS v)
  SELECT CASE WHEN (SELECT v FROM j) IS NULL OR (SELECT v FROM c) IS NULL THEN NULL
              ELSE round(100 * (0.5 * (SELECT v FROM j) + 0.5 * (SELECT v FROM c)))::integer END
$$;
REVOKE ALL ON FUNCTION public._taste_score(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taste_match(p_other uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL OR p_other = auth.uid() OR public.blocked_between(auth.uid(), p_other) THEN NULL
              ELSE public._taste_score(auth.uid(), p_other) END
$$;
REVOKE ALL ON FUNCTION public.taste_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taste_match(uuid) TO authenticated;

-- People who opted in to being found, ranked by Taste Match.
CREATE OR REPLACE FUNCTION public.taste_match_people()
RETURNS TABLE(user_id uuid, score integer, shared_spots integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (SELECT DISTINCT restaurant_id FROM public.stamps WHERE user_id = auth.uid()),
  cand AS (
    SELECT p.id FROM public.profiles p
     WHERE p.discoverable AND p.id <> auth.uid() AND NOT public.blocked_between(auth.uid(), p.id)
       AND EXISTS (SELECT 1 FROM public.stamps s WHERE s.user_id = p.id)
  )
  SELECT c.id, public._taste_score(auth.uid(), c.id),
         (SELECT count(DISTINCT s.restaurant_id)::integer FROM public.stamps s JOIN mine m ON m.restaurant_id = s.restaurant_id WHERE s.user_id = c.id)
    FROM cand c
   WHERE auth.uid() IS NOT NULL
   ORDER BY 2 DESC NULLS LAST, 3 DESC
   LIMIT 30
$$;
REVOKE ALL ON FUNCTION public.taste_match_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taste_match_people() TO authenticated;

-- ---------- Table for 4: group meetups at a restaurant ----------
CREATE TABLE public.meetups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 60),
  note text CHECK (length(note) <= 280),
  starts_at timestamptz NOT NULL,
  seats integer NOT NULL CHECK (seats BETWEEN 3 AND 8),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meetups_starts ON public.meetups(starts_at) WHERE status = 'open';
CREATE TABLE public.meetup_members (
  meetup_id uuid NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetup_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meetups, public.meetup_members FROM anon, authenticated;
GRANT SELECT ON public.meetups, public.meetup_members TO authenticated;
GRANT ALL ON public.meetups, public.meetup_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_meetup_member(_meetup uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.meetup_members WHERE meetup_id = _meetup AND user_id = auth.uid())
$$;
CREATE POLICY "Adults see tables" ON public.meetups FOR SELECT TO authenticated
  USING (public.is_adult(auth.uid()) AND NOT public.blocked_between(auth.uid(), host_id));
CREATE POLICY "Members see who's coming" ON public.meetup_members FOR SELECT TO authenticated
  USING (public.is_meetup_member(meetup_id));

CREATE OR REPLACE FUNCTION public.create_meetup(p_restaurant_id uuid, p_title text, p_note text, p_starts_at timestamptz, p_seats integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT public.is_adult(auth.uid()) THEN RAISE EXCEPTION 'Tables are for people 18 and over. Add your birthday in Profile.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id AND is_active) THEN RAISE EXCEPTION 'Pick a spot on Bite'; END IF;
  IF p_starts_at < now() + interval '30 minutes' OR p_starts_at > now() + interval '14 days' THEN
    RAISE EXCEPTION 'Pick a time between 30 minutes and 2 weeks from now';
  END IF;
  IF (SELECT count(*) FROM public.meetups WHERE host_id = auth.uid() AND status = 'open' AND starts_at > now()) >= 3 THEN
    RAISE EXCEPTION 'You can host up to 3 upcoming tables at a time';
  END IF;
  INSERT INTO public.meetups(host_id, restaurant_id, title, note, starts_at, seats)
  VALUES (auth.uid(), p_restaurant_id, trim(p_title), nullif(trim(coalesce(p_note, '')), ''), p_starts_at, p_seats)
  RETURNING id INTO mid;
  INSERT INTO public.meetup_members(meetup_id, user_id) VALUES (mid, auth.uid());
  INSERT INTO public.activity(user_id, kind, restaurant_id) VALUES (auth.uid(), 'table', p_restaurant_id);
  RETURN mid;
END $$;
REVOKE ALL ON FUNCTION public.create_meetup(uuid, text, text, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_meetup(uuid, text, text, timestamptz, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_meetup(p_meetup_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.meetups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT public.is_adult(auth.uid()) THEN RAISE EXCEPTION 'Tables are for people 18 and over. Add your birthday in Profile.'; END IF;
  SELECT * INTO m FROM public.meetups WHERE id = p_meetup_id FOR UPDATE;
  IF NOT FOUND OR m.status <> 'open' OR m.starts_at <= now() THEN RAISE EXCEPTION 'This table isn''t open'; END IF;
  IF EXISTS (SELECT 1 FROM public.meetup_members mm WHERE mm.meetup_id = m.id AND public.blocked_between(auth.uid(), mm.user_id)) THEN
    RAISE EXCEPTION 'You can''t join this table';
  END IF;
  IF (SELECT count(*) FROM public.meetup_members WHERE meetup_id = m.id) >= m.seats THEN RAISE EXCEPTION 'This table is full'; END IF;
  INSERT INTO public.meetup_members(meetup_id, user_id) VALUES (m.id, auth.uid()) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.join_meetup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_meetup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_meetup(p_meetup_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.meetups WHERE id = p_meetup_id AND host_id = auth.uid()) THEN
    UPDATE public.meetups SET status = 'cancelled' WHERE id = p_meetup_id;
  END IF;
  DELETE FROM public.meetup_members WHERE meetup_id = p_meetup_id AND user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.leave_meetup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_meetup(uuid) TO authenticated;

-- Listing for the Tables screen (adults only; hides tables with blocked people).
CREATE OR REPLACE FUNCTION public.list_meetups()
RETURNS TABLE(id uuid, restaurant_id uuid, title text, note text, starts_at timestamptz, seats integer, members integer, host_id uuid, host_name text, joined boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.restaurant_id, m.title, m.note, m.starts_at, m.seats,
         (SELECT count(*)::integer FROM public.meetup_members mm WHERE mm.meetup_id = m.id),
         m.host_id,
         coalesce((SELECT nullif(split_part(trim(full_name), ' ', 1), '') FROM public.profiles WHERE id = m.host_id), 'Someone'),
         EXISTS (SELECT 1 FROM public.meetup_members mm WHERE mm.meetup_id = m.id AND mm.user_id = auth.uid())
    FROM public.meetups m
   WHERE public.is_adult(auth.uid())
     AND m.status = 'open' AND m.starts_at > now() - interval '2 hours'
     AND NOT EXISTS (SELECT 1 FROM public.meetup_members mm WHERE mm.meetup_id = m.id AND public.blocked_between(auth.uid(), mm.user_id))
   ORDER BY m.starts_at
   LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.list_meetups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_meetups() TO authenticated;

-- ---------- reports ----------
CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reported_user_id uuid,
  meetup_id uuid REFERENCES public.meetups(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_reports FROM anon, authenticated;
GRANT INSERT (reported_user_id, meetup_id, reason) ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
CREATE POLICY "Users file reports" ON public.user_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
