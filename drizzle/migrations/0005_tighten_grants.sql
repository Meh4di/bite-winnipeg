-- New tables get broad default privileges in this project, so column-level
-- grants only bite after revoking the table-level ones first.
REVOKE ALL ON public.reviews FROM anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT (restaurant_id, rating, body, tags, photo_urls) ON public.reviews TO authenticated;
GRANT UPDATE (rating, body, tags, photo_urls) ON public.reviews TO authenticated;
GRANT DELETE ON public.reviews TO authenticated;

REVOKE ALL ON public.review_reports FROM anon, authenticated;
GRANT INSERT (review_id, reason) ON public.review_reports TO authenticated;

REVOKE ALL ON public.dish_ratings FROM anon, authenticated;
GRANT SELECT ON public.dish_ratings TO anon, authenticated;
GRANT INSERT (menu_item_id, restaurant_id, rating) ON public.dish_ratings TO authenticated;
GRANT UPDATE (rating) ON public.dish_ratings TO authenticated;
GRANT DELETE ON public.dish_ratings TO authenticated;

REVOKE ALL ON public.forward_meals FROM anon, authenticated;
GRANT SELECT ON public.forward_meals TO authenticated;

REVOKE ALL ON public.food_donations FROM anon, authenticated;
GRANT SELECT, INSERT ON public.food_donations TO authenticated;

REVOKE ALL ON public.crawls, public.crawl_stops FROM anon, authenticated;
GRANT SELECT ON public.crawls, public.crawl_stops TO anon, authenticated;

REVOKE ALL ON public.reward_redemptions FROM anon, authenticated;
GRANT SELECT ON public.reward_redemptions TO authenticated;

REVOKE ALL ON public.decide_sessions, public.decide_members FROM anon, authenticated;
GRANT SELECT ON public.decide_sessions, public.decide_members TO authenticated;
REVOKE ALL ON public.decide_votes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.decide_votes TO authenticated;
