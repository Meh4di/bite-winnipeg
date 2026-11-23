DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles visible to signed-in users" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR (NOT public.blocked_between(auth.uid(), id) AND (discoverable OR EXISTS (SELECT 1 FROM public.user_follows f WHERE (f.follower_id = auth.uid() AND f.followee_id = profiles.id) OR (f.followee_id = auth.uid() AND f.follower_id = profiles.id)))));

DROP POLICY IF EXISTS "Bite images public read" ON storage.objects;
DROP POLICY IF EXISTS "Event photos read" ON storage.objects;
DROP POLICY IF EXISTS "Review photos read" ON storage.objects;
CREATE POLICY "Uploaders read own photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('restaurant-logos','restaurant-covers','menu-photos','event-photos','review-photos') AND (storage.foldername(name))[1] = (auth.uid())::text);