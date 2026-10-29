ALTER TABLE public.restaurants ADD COLUMN accepting_orders boolean NOT NULL DEFAULT true;
ALTER TABLE public.orders ADD COLUMN note text NOT NULL DEFAULT '', ADD COLUMN customer_name text NOT NULL DEFAULT 'Guest', ADD COLUMN order_number text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)), ADD COLUMN payment_mode text NOT NULL DEFAULT 'test';
CREATE UNIQUE INDEX orders_order_number_unique ON public.orders(order_number);
ALTER TABLE public.order_items ADD COLUMN item_name text NOT NULL DEFAULT '';
ALTER TABLE public.stamps ADD COLUMN order_id uuid REFERENCES public.orders(id);
CREATE UNIQUE INDEX stamps_one_per_order ON public.stamps(order_id) WHERE order_id IS NOT NULL;
REVOKE INSERT, UPDATE ON public.orders FROM authenticated;
GRANT UPDATE(status) ON public.orders TO authenticated;
REVOKE INSERT ON public.order_items FROM authenticated;

CREATE OR REPLACE FUNCTION public.validate_order_transition() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NOT ((OLD.status = 'paid' AND NEW.status = 'preparing') OR (OLD.status = 'preparing' AND NEW.status = 'ready') OR (OLD.status = 'ready' AND NEW.status = 'picked_up')) THEN
   RAISE EXCEPTION 'Invalid order status transition';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_order_status BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_transition();
CREATE OR REPLACE FUNCTION public.award_order_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status = 'picked_up' AND OLD.status IS DISTINCT FROM 'picked_up' THEN
  INSERT INTO public.stamps(user_id, restaurant_id, source, order_id) VALUES (NEW.user_id, NEW.restaurant_id, 'order', NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER award_pickup_stamp AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.award_order_stamp();

CREATE OR REPLACE FUNCTION public.checkout_test_order(p_order_id uuid, p_restaurant_id uuid, p_items jsonb, p_note text, p_pickup_time timestamptz DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 r public.restaurants%ROWTYPE; existing public.orders%ROWTYPE; m public.menu_items%ROWTYPE; line jsonb; qty integer; total bigint := 0; name text; pickup timestamptz; local_now timestamp := now() AT TIME ZONE 'America/Winnipeg'; local_pickup timestamp; d date; h jsonb; opens timestamp; closes timestamp; is_open boolean := false; found_day boolean := false; i integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to place an order'; END IF;
 SELECT * INTO existing FROM public.orders WHERE id = p_order_id;
 IF FOUND THEN
  IF existing.user_id <> auth.uid() THEN RAISE EXCEPTION 'Order unavailable'; END IF;
  RETURN existing.id;
 END IF;
 SELECT * INTO r FROM public.restaurants WHERE id = p_restaurant_id FOR SHARE;
 IF NOT FOUND OR NOT r.is_active OR NOT r.accepting_orders THEN RAISE EXCEPTION 'Not taking orders right now'; END IF;
 IF p_note IS NULL OR length(p_note) > 1000 THEN RAISE EXCEPTION 'Note must be at most 1000 characters'; END IF;
 IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 100 THEN RAISE EXCEPTION 'Your cart is empty or too large'; END IF;
 IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Duplicate cart items'; END IF;
 FOR i IN 0..7 LOOP
  d := local_now::date + i;
  h := r.hours->lower(to_char(d, 'Dy'));
  IF h IS NULL OR coalesce((h->>'closed')::boolean, false) OR h->>'open' IS NULL OR h->>'close' IS NULL THEN CONTINUE; END IF;
  opens := d + (h->>'open')::time; closes := d + (h->>'close')::time;
  IF closes <= opens OR closes <= local_now OR (i = 0 AND local_now + interval '15 minutes' >= closes) THEN CONTINUE; END IF;
  is_open := i = 0 AND local_now >= opens AND local_now < closes;
  found_day := true; EXIT;
 END LOOP;
 IF NOT found_day THEN RAISE EXCEPTION 'No pickup times available'; END IF;
 IF p_pickup_time IS NULL THEN
  IF NOT is_open THEN RAISE EXCEPTION 'Choose a scheduled pickup time'; END IF;
  pickup := (local_now + interval '15 minutes') AT TIME ZONE 'America/Winnipeg';
 ELSE pickup := p_pickup_time; END IF;
 local_pickup := pickup AT TIME ZONE 'America/Winnipeg';
 IF local_pickup::date <> d OR local_pickup < opens OR local_pickup >= closes OR pickup < now() + interval '15 minutes' THEN RAISE EXCEPTION 'Choose a valid pickup time within opening hours'; END IF;
 IF p_pickup_time IS NOT NULL AND (extract(minute FROM local_pickup)::integer % 15 <> 0 OR extract(second FROM local_pickup) <> 0) THEN RAISE EXCEPTION 'Pickup slots are every 15 minutes'; END IF;
 FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  qty := (line->>'quantity')::integer;
  IF qty IS NULL OR qty < 1 OR qty > 99 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
  SELECT * INTO m FROM public.menu_items WHERE id = (line->>'id')::uuid AND restaurant_id = r.id AND is_available AND NOT is_secret FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An item is no longer available'; END IF;
  total := total + m.price_cents::bigint * qty;
 END LOOP;
 IF total > 2147483647 THEN RAISE EXCEPTION 'Order total too large'; END IF;
 SELECT coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Guest') INTO name FROM public.profiles WHERE id = auth.uid();
 INSERT INTO public.orders(id, user_id, restaurant_id, status, pickup_time, total_cents, note, customer_name, payment_mode) VALUES (p_order_id, auth.uid(), r.id, 'paid', pickup, total::integer, p_note, coalesce(name,'Guest'), 'test');
 FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO m FROM public.menu_items WHERE id = (line->>'id')::uuid;
  INSERT INTO public.order_items(order_id, menu_item_id, quantity, price_cents, item_name) VALUES (p_order_id, m.id, (line->>'quantity')::integer, m.price_cents, m.name);
 END LOOP;
 RETURN p_order_id;
END; $$;
REVOKE ALL ON FUNCTION public.checkout_test_order(uuid, uuid, jsonb, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_test_order(uuid, uuid, jsonb, text, timestamptz) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;