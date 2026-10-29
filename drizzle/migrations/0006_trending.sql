-- "Trending this week": activity over the last 7 days, weighted, no personal data.
CREATE OR REPLACE FUNCTION public.trending_spots(p_days integer DEFAULT 7)
RETURNS TABLE(restaurant_id uuid, score integer, orders integer, stamps integer, reviews integer, follows integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH since AS (SELECT now() - make_interval(days => least(greatest(p_days, 1), 30)) AS t),
  o AS (SELECT restaurant_id, count(*) n FROM public.orders, since WHERE status <> 'cancelled' AND created_at > since.t GROUP BY 1),
  s AS (SELECT restaurant_id, count(*) n FROM public.stamps, since WHERE created_at > since.t GROUP BY 1),
  rv AS (SELECT restaurant_id, count(*) n FROM public.reviews, since WHERE created_at > since.t GROUP BY 1),
  f AS (SELECT restaurant_id, count(*) n FROM public.follows, since WHERE created_at > since.t GROUP BY 1),
  dr AS (SELECT restaurant_id, count(*) n FROM public.dish_ratings, since WHERE updated_at > since.t GROUP BY 1)
  SELECT r.id,
         (coalesce(o.n, 0) * 3 + coalesce(s.n, 0) * 2 + coalesce(rv.n, 0) * 2 + coalesce(f.n, 0) + coalesce(dr.n, 0) / 3)::integer,
         coalesce(o.n, 0)::integer, coalesce(s.n, 0)::integer, coalesce(rv.n, 0)::integer, coalesce(f.n, 0)::integer
    FROM public.restaurants r
    LEFT JOIN o ON o.restaurant_id = r.id
    LEFT JOIN s ON s.restaurant_id = r.id
    LEFT JOIN rv ON rv.restaurant_id = r.id
    LEFT JOIN f ON f.restaurant_id = r.id
    LEFT JOIN dr ON dr.restaurant_id = r.id
   WHERE r.is_active
   ORDER BY 2 DESC, r.name
   LIMIT 10
$$;
GRANT EXECUTE ON FUNCTION public.trending_spots(integer) TO anon, authenticated;
