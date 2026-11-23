DROP POLICY IF EXISTS "Reviews are public" ON public.reviews;
CREATE POLICY "Reviews visible for visible spots" ON public.reviews FOR SELECT
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = reviews.restaurant_id));

DROP POLICY IF EXISTS "Dish ratings are public" ON public.dish_ratings;
CREATE POLICY "Dish ratings visible for visible spots" ON public.dish_ratings FOR SELECT
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = dish_ratings.restaurant_id));

DROP POLICY IF EXISTS "Drops public" ON public.drops;
CREATE POLICY "Drops visible for visible spots" ON public.drops FOR SELECT
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = drops.restaurant_id));

DROP POLICY IF EXISTS "Promotions public" ON public.promotions;
CREATE POLICY "Promotions visible for visible spots" ON public.promotions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = promotions.restaurant_id));

DROP POLICY IF EXISTS "Crawl stops are public" ON public.crawl_stops;
CREATE POLICY "Crawl stops of active crawls" ON public.crawl_stops FOR SELECT
USING (EXISTS (SELECT 1 FROM public.crawls c WHERE c.id = crawl_stops.crawl_id));