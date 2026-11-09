-- What's on in Winnipeg: public events (games, concerts, festivals, markets, pop-ups, restaurant nights).
-- Friends see who's going; restaurants attach "Eat near this event" deals so going out turns into visits.
-- Verified businesses publish instantly; everyone else's events wait for an admin.

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 90),
  description text CHECK (char_length(description) <= 1500),
  category text NOT NULL CHECK (category IN ('game','concert','festival','market','popup','food-truck','restaurant-night','cultural','community','other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  venue_name text NOT NULL CHECK (char_length(venue_name) BETWEEN 2 AND 90),
  address text CHECK (char_length(address) <= 160),
  lat double precision CHECK (lat IS NULL OR lat BETWEEN 49.6 AND 50.2),
  lng double precision CHECK (lng IS NULL OR lng BETWEEN -97.6 AND -96.7),
  photo_url text,
  is_free boolean NOT NULL DEFAULT false,
  price_text text CHECK (char_length(price_text) <= 40),
  link_url text CHECK (link_url IS NULL OR link_url ~* '^https://'),
  tags text[] NOT NULL DEFAULT '{}' CHECK (tags <@ ARRAY['family','halal','vegan','19+','outdoor','newcomer-friendly','accessible']::text[]),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  review_note text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '21 days')
);
CREATE INDEX events_upcoming ON public.events (starts_at) WHERE status = 'approved';
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.events FROM anon, authenticated;
GRANT SELECT ON public.events TO anon, authenticated;
CREATE POLICY "Approved events are public" ON public.events FOR SELECT USING (status = 'approved');
CREATE POLICY "Own events" ON public.events FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Admins see events" ON public.events FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.event_rsvps (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('going','interested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_rsvps FROM anon, authenticated;
GRANT SELECT ON public.event_rsvps TO authenticated;
CREATE POLICY "Own RSVPs" ON public.event_rsvps FOR SELECT TO authenticated USING (user_id = auth.uid());

-- A restaurant's offer for people going to an event ("Show your ticket: free fries").
CREATE TABLE public.event_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  details text CHECK (char_length(details) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, restaurant_id)
);
ALTER TABLE public.event_deals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_deals FROM anon, authenticated;
GRANT SELECT ON public.event_deals TO anon, authenticated;
CREATE POLICY "Deals on approved events" ON public.event_deals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'approved')
  AND public.is_verified_restaurant(restaurant_id));

-- ---------- posting ----------
CREATE OR REPLACE FUNCTION public.submit_event(
  p_title text, p_description text, p_category text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_venue_name text, p_address text, p_lat double precision, p_lng double precision, p_photo_url text,
  p_is_free boolean, p_price_text text, p_link_url text, p_tags text[], p_restaurant_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st text := 'pending'; new_id uuid; recent integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to post an event'; END IF;
  IF p_starts_at < now() - interval '1 hour' THEN RAISE EXCEPTION 'That start time has already passed'; END IF;
  IF p_starts_at > now() + interval '1 year' THEN RAISE EXCEPTION 'Events can be posted up to a year ahead'; END IF;
  IF p_restaurant_id IS NOT NULL THEN
    IF NOT public.owns_restaurant(p_restaurant_id) THEN RAISE EXCEPTION 'You can only post for your own restaurant'; END IF;
    IF public.is_verified_restaurant(p_restaurant_id) THEN st := 'approved'; END IF;
  END IF;
  -- Spam brake for community posts.
  SELECT count(*) INTO recent FROM public.events WHERE created_by = auth.uid() AND created_at > now() - interval '1 day';
  IF recent >= 10 THEN RAISE EXCEPTION 'That''s a lot of events for one day. Try again tomorrow.'; END IF;
  INSERT INTO public.events (created_by, restaurant_id, title, description, category, starts_at, ends_at, venue_name, address,
                             lat, lng, photo_url, is_free, price_text, link_url, tags, status)
  VALUES (auth.uid(), p_restaurant_id, trim(p_title), nullif(trim(p_description), ''), p_category, p_starts_at, p_ends_at,
          trim(p_venue_name), nullif(trim(p_address), ''), p_lat, p_lng, p_photo_url, coalesce(p_is_free, false),
          nullif(trim(p_price_text), ''), nullif(trim(p_link_url), ''), coalesce(p_tags, '{}'), st)
  RETURNING events.id INTO new_id;
  RETURN QUERY SELECT new_id, st;
END $$;
REVOKE ALL ON FUNCTION public.submit_event(text,text,text,timestamptz,timestamptz,text,text,double precision,double precision,text,boolean,text,text,text[],uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_event(text,text,text,timestamptz,timestamptz,text,text,double precision,double precision,text,boolean,text,text,text[],uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.events SET status = 'cancelled'
   WHERE id = p_event_id AND (created_by = auth.uid() OR public.is_admin()) AND status <> 'cancelled';
  IF NOT FOUND THEN RAISE EXCEPTION 'You can only cancel your own events'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.cancel_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_event(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_event_queue()
RETURNS SETOF public.events LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY SELECT * FROM public.events WHERE status = 'pending' AND ends_at > now() ORDER BY created_at;
END $$;
REVOKE ALL ON FUNCTION public.admin_event_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_event_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.review_event(p_event_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.events SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, review_note = p_note
   WHERE id = p_event_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found or already reviewed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_event(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_event(uuid, boolean, text) TO authenticated;

-- ---------- going / interested ----------
CREATE OR REPLACE FUNCTION public.rsvp_event(p_event_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_status IS NULL THEN
    DELETE FROM public.event_rsvps WHERE event_id = p_event_id AND user_id = auth.uid();
    RETURN;
  END IF;
  IF p_status NOT IN ('going','interested') THEN RAISE EXCEPTION 'Unknown choice'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND status = 'approved' AND ends_at > now()) THEN
    RAISE EXCEPTION 'This event isn''t available';
  END IF;
  INSERT INTO public.event_rsvps (event_id, user_id, status) VALUES (p_event_id, auth.uid(), p_status)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status, created_at = now();
END $$;
REVOKE ALL ON FUNCTION public.rsvp_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_event(uuid, text) TO authenticated;

-- Counts for every upcoming event, plus which of MY friends are going (first names, never strangers).
CREATE OR REPLACE FUNCTION public.event_stats()
RETURNS TABLE (event_id uuid, going integer, interested integer, my_status text, friends_going integer, friend_names text[], deals integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id,
         (SELECT count(*)::integer FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'going'),
         (SELECT count(*)::integer FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'interested'),
         (SELECT r.status FROM public.event_rsvps r WHERE r.event_id = e.id AND r.user_id = auth.uid()),
         (SELECT count(*)::integer FROM public.event_rsvps r
           WHERE r.event_id = e.id AND r.status = 'going' AND auth.uid() IS NOT NULL
             AND r.user_id <> auth.uid() AND public.are_friends(auth.uid(), r.user_id)),
         (SELECT coalesce(array_agg(n ORDER BY n), '{}') FROM (
            SELECT coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'A friend') n
              FROM public.event_rsvps r JOIN public.profiles p ON p.id = r.user_id
             WHERE r.event_id = e.id AND r.status = 'going' AND auth.uid() IS NOT NULL
               AND r.user_id <> auth.uid() AND public.are_friends(auth.uid(), r.user_id)
             LIMIT 3) f),
         (SELECT count(*)::integer FROM public.event_deals d WHERE d.event_id = e.id AND public.is_verified_restaurant(d.restaurant_id))
    FROM public.events e
   WHERE e.status = 'approved' AND e.ends_at > now() - interval '6 hours'
$$;
GRANT EXECUTE ON FUNCTION public.event_stats() TO anon, authenticated;

-- ---------- restaurant deals for event-goers ----------
CREATE OR REPLACE FUNCTION public.add_event_deal(p_event_id uuid, p_restaurant_id uuid, p_title text, p_details text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owns_restaurant(p_restaurant_id) THEN RAISE EXCEPTION 'Only the restaurant can do this'; END IF;
  IF NOT public.is_verified_restaurant(p_restaurant_id) THEN RAISE EXCEPTION 'Get verified first to post deals'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND status = 'approved' AND ends_at > now()) THEN
    RAISE EXCEPTION 'This event isn''t available';
  END IF;
  INSERT INTO public.event_deals (event_id, restaurant_id, title, details)
  VALUES (p_event_id, p_restaurant_id, trim(p_title), nullif(trim(p_details), ''))
  ON CONFLICT (event_id, restaurant_id) DO UPDATE SET title = EXCLUDED.title, details = EXCLUDED.details;
END $$;
REVOKE ALL ON FUNCTION public.add_event_deal(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_event_deal(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_event_deal(p_event_id uuid, p_restaurant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owns_restaurant(p_restaurant_id) THEN RAISE EXCEPTION 'Only the restaurant can do this'; END IF;
  DELETE FROM public.event_deals WHERE event_id = p_event_id AND restaurant_id = p_restaurant_id;
END $$;
REVOKE ALL ON FUNCTION public.remove_event_deal(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_event_deal(uuid, uuid) TO authenticated;

-- ---------- photos ----------
INSERT INTO storage.buckets (id, name, public) VALUES ('event-photos', 'event-photos', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Event photos read" ON storage.objects FOR SELECT USING (bucket_id = 'event-photos');
CREATE POLICY "Event photos upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'event-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Event photos delete own" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'event-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
