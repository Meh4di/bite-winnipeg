-- Tables are now friends-only: you see and join a table only if you and the host follow each other.
-- No meetups with strangers.
CREATE OR REPLACE FUNCTION public.can_see_meetup(_host uuid, _meetup uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _host = auth.uid()
    OR public.is_meetup_member(_meetup)
    OR (public.are_friends(auth.uid(), _host) AND NOT public.blocked_between(auth.uid(), _host))
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_see_meetup(uuid, uuid) TO authenticated;

DROP POLICY "Adults see tables" ON public.meetups;
CREATE POLICY "Friends see tables" ON public.meetups FOR SELECT TO authenticated
  USING (public.is_adult(auth.uid()) AND public.can_see_meetup(host_id, id));

CREATE OR REPLACE FUNCTION public.join_meetup(p_meetup_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.meetups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT public.is_adult(auth.uid()) THEN RAISE EXCEPTION 'Tables are for people 18 and over. Add your birthday in Profile.'; END IF;
  SELECT * INTO m FROM public.meetups WHERE id = p_meetup_id FOR UPDATE;
  IF NOT FOUND OR m.status <> 'open' OR m.starts_at <= now() THEN RAISE EXCEPTION 'This table isn''t open'; END IF;
  IF NOT public.are_friends(auth.uid(), m.host_id) THEN
    RAISE EXCEPTION 'Tables are friends-only. You and the host need to follow each other.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.meetup_members mm WHERE mm.meetup_id = m.id AND public.blocked_between(auth.uid(), mm.user_id)) THEN
    RAISE EXCEPTION 'You can''t join this table';
  END IF;
  IF (SELECT count(*) FROM public.meetup_members WHERE meetup_id = m.id) >= m.seats THEN RAISE EXCEPTION 'This table is full'; END IF;
  INSERT INTO public.meetup_members(meetup_id, user_id) VALUES (m.id, auth.uid()) ON CONFLICT DO NOTHING;
END $$;

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
     AND public.can_see_meetup(m.host_id, m.id)
     AND m.status = 'open' AND m.starts_at > now() - interval '2 hours'
     AND NOT EXISTS (SELECT 1 FROM public.meetup_members mm WHERE mm.meetup_id = m.id AND public.blocked_between(auth.uid(), mm.user_id))
   ORDER BY m.starts_at
   LIMIT 50
$$;
