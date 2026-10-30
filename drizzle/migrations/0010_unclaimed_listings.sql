-- Real Winnipeg spots as UNCLAIMED listings: public facts only (name, type, neighbourhood, address).
-- No menus, prices, deals or ratings until the real owner claims and is verified.

DO $c$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.restaurants'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%verification_status%';
  EXECUTE format('ALTER TABLE public.restaurants DROP CONSTRAINT %I', c);
END $c$;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_verification_status_check
  CHECK (verification_status IN ('unclaimed', 'unverified', 'pending', 'verified', 'rejected'));
ALTER TABLE public.restaurants ADD COLUMN is_sample boolean NOT NULL DEFAULT false;
UPDATE public.restaurants SET is_sample = true
 WHERE slug IN ('ember-roasters', 'taco-norte', 'maison-rosie', 'corydon-noodle-bar', 'forks-fire-pizza', 'sunny-side-osborne');

-- Unclaimed listings may be public (directory only) but never take orders.
CREATE OR REPLACE FUNCTION public.restaurants_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.free_until := now() + interval '3 months';
      NEW.verification_status := 'unverified';
      NEW.verified_at := NULL;
      NEW.is_sample := false;
    ELSE
      NEW.free_until := OLD.free_until;
      NEW.verification_status := OLD.verification_status;
      NEW.verified_at := OLD.verified_at;
      NEW.owner_id := OLD.owner_id;
      NEW.is_sample := OLD.is_sample;
    END IF;
  END IF;
  IF NEW.verification_status <> 'verified' THEN
    NEW.accepting_orders := false;
    IF NEW.verification_status <> 'unclaimed' THEN NEW.is_active := false; END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.busy_level IS DISTINCT FROM OLD.busy_level OR NEW.wait_minutes IS DISTINCT FROM OLD.wait_minutes THEN
    NEW.busy_updated_at := CASE WHEN NEW.busy_level IS NULL AND NEW.wait_minutes IS NULL THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE public.business_verifications ADD COLUMN kind text NOT NULL DEFAULT 'own' CHECK (kind IN ('own', 'claim'));

-- Same RPC handles "verify my own new page" and "claim an existing listing".
CREATE OR REPLACE FUNCTION public.submit_verification(
  p_restaurant_id uuid, p_legal_name text, p_contact_name text, p_contact_role text, p_business_phone text,
  p_business_email text, p_website text, p_business_number text, p_permit_number text, p_doc_paths text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; r public.restaurants; p text; v_kind text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO r FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Set up your restaurant page first'; END IF;
  IF r.owner_id IS NULL AND r.verification_status = 'unclaimed' THEN
    v_kind := 'claim';
  ELSIF r.owner_id = auth.uid() THEN
    v_kind := 'own';
    IF r.verification_status = 'verified' THEN RAISE EXCEPTION 'Your restaurant is already verified'; END IF;
  ELSE
    RAISE EXCEPTION 'This restaurant is already managed by someone. Contact Bite if that''s wrong.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.business_verifications WHERE restaurant_id = r.id AND status = 'pending') THEN
    RAISE EXCEPTION 'We''re already reviewing a request for this restaurant';
  END IF;
  IF coalesce(cardinality(p_doc_paths), 0) = 0 THEN RAISE EXCEPTION 'Add at least one document'; END IF;
  FOREACH p IN ARRAY p_doc_paths LOOP
    IF split_part(p, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'Upload your documents again'; END IF;
  END LOOP;
  INSERT INTO public.business_verifications (restaurant_id, submitted_by, kind, legal_name, contact_name, contact_role,
      business_phone, business_email, website, business_number, permit_number, doc_paths)
    VALUES (r.id, auth.uid(), v_kind, trim(p_legal_name), trim(p_contact_name), p_contact_role, trim(p_business_phone),
      nullif(trim(p_business_email), ''), nullif(trim(p_website), ''), nullif(trim(p_business_number), ''),
      nullif(trim(p_permit_number), ''), p_doc_paths)
    RETURNING id INTO v_id;
  IF v_kind = 'own' THEN
    UPDATE public.restaurants SET verification_status = 'pending' WHERE id = r.id;
  ELSE
    -- Claimers get the business dashboard so they can follow their request; tools stay locked until approval.
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'restaurant_owner') ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.review_verification(p_id uuid, p_approve boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.business_verifications;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO v FROM public.business_verifications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v.status <> 'pending' THEN RAISE EXCEPTION 'This application was already reviewed'; END IF;
  IF NOT p_approve AND coalesce(trim(p_note), '') = '' THEN RAISE EXCEPTION 'Tell them why, so they can fix it'; END IF;
  UPDATE public.business_verifications
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         admin_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = p_id;
  IF p_approve THEN
    -- The 3 free months start the day they're verified.
    UPDATE public.restaurants
       SET owner_id = CASE WHEN v.kind = 'claim' THEN v.submitted_by ELSE owner_id END,
           verification_status = 'verified', verified_at = now(), free_until = now() + interval '3 months',
           is_active = true, accepting_orders = true
     WHERE id = v.restaurant_id;
  ELSIF v.kind = 'own' THEN
    UPDATE public.restaurants SET verification_status = 'rejected' WHERE id = v.restaurant_id;
  END IF; -- a rejected claim leaves the listing unclaimed
END $$;

DROP FUNCTION public.verification_queue();
CREATE FUNCTION public.verification_queue()
RETURNS TABLE (id uuid, kind text, restaurant_id uuid, restaurant_name text, restaurant_slug text, restaurant_address text,
  restaurant_phone text, owner_email text, legal_name text, contact_name text, contact_role text, business_phone text,
  business_email text, website text, business_number text, permit_number text, doc_paths text[], status text,
  admin_note text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT v.id, v.kind, r.id, r.name, r.slug, r.address, r.phone, u.email::text, v.legal_name, v.contact_name, v.contact_role,
           v.business_phone, v.business_email, v.website, v.business_number, v.permit_number, v.doc_paths, v.status,
           v.admin_note, v.created_at
      FROM public.business_verifications v
      JOIN public.restaurants r ON r.id = v.restaurant_id
      LEFT JOIN auth.users u ON u.id = v.submitted_by
     ORDER BY (v.status = 'pending') DESC, v.created_at DESC
     LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.verification_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verification_queue() TO authenticated;

-- "This place closed / info is wrong" reports from customers; admins can hide a listing.
CREATE TABLE public.listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL CHECK (reason IN ('closed', 'wrong_info', 'other')),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, reporter_id)
);
ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_reports FROM anon, authenticated;
GRANT INSERT (restaurant_id, reason, note) ON public.listing_reports TO authenticated;
GRANT SELECT ON public.listing_reports TO authenticated;
GRANT ALL ON public.listing_reports TO service_role;
CREATE POLICY "Report a listing" ON public.listing_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admins read reports" ON public.listing_reports FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_listing_reports()
RETURNS TABLE (restaurant_id uuid, restaurant_name text, restaurant_slug text, verification_status text, is_active boolean,
  reports integer, closed_reports integer, notes text[], last_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT r.id, r.name, r.slug, r.verification_status, r.is_active, count(*)::integer,
           count(*) FILTER (WHERE lr.reason = 'closed')::integer,
           array_remove(array_agg(lr.note ORDER BY lr.created_at DESC), NULL), max(lr.created_at)
      FROM public.listing_reports lr JOIN public.restaurants r ON r.id = lr.restaurant_id
     WHERE NOT lr.resolved
     GROUP BY r.id ORDER BY max(lr.created_at) DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_listing_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_listing_reports() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_listing(p_restaurant_id uuid, p_hide boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_hide THEN UPDATE public.restaurants SET is_active = false WHERE id = p_restaurant_id; END IF;
  UPDATE public.listing_reports SET resolved = true WHERE restaurant_id = p_restaurant_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_resolve_listing(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_listing(uuid, boolean) TO authenticated;

-- The listings themselves (checked against current public listings, October 2026).
INSERT INTO public.restaurants (name, slug, category, neighbourhood, address, verification_status, is_active, accepting_orders, hours)
SELECT v.name, v.slug, v.category, v.neighbourhood, v.address, 'unclaimed', true, false, '{}'::jsonb
  FROM (VALUES
  ('Parlour Coffee', 'parlour-coffee', 'Coffee', 'Exchange District', '468 Main St, Winnipeg, MB'),
  ('Thom Bargen Coffee Roasters', 'thom-bargen-coffee-roasters', 'Coffee', 'West Broadway', '64 Sherbrook St, Winnipeg, MB'),
  ('Fools & Horses Coffee Company', 'fools-horses-coffee-company', 'Coffee', 'The Forks', '1 Forks Market Rd, Winnipeg, MB'),
  ('Little Sister Coffee Maker', 'little-sister-coffee-maker', 'Coffee', 'Exchange District', '171 McDermot Ave, Winnipeg, MB'),
  ('Más Coffee Co', 'mas-coffee-co', 'Coffee', 'Exchange District', '70 Arthur St, Suite 100, Winnipeg, MB'),
  ('Café Postal', 'cafe-postal', 'Coffee', 'St. Boniface', '202 Provencher Blvd, Winnipeg, MB'),
  ('Tall Grass Prairie Bread Company', 'tall-grass-prairie-bread-company', 'Bakery', 'Wolseley', '859 Westminster Ave, Winnipeg, MB'),
  ('La Belle Baguette', 'la-belle-baguette', 'Bakery', 'St. Boniface', '248 De La Cathédrale Ave, Winnipeg, MB'),
  ('A l''Épi de Blé', 'a-lepi-de-ble', 'Bakery', 'North End', '1757 Main St, Winnipeg, MB'),
  ('Lilac Bakery', 'lilac-bakery', 'Bakery', 'Corydon', '920 Grosvenor Ave, Winnipeg, MB'),
  ('French Way Café', 'french-way-cafe', 'Bakery', 'Corydon', '238 Lilac St, Winnipeg, MB'),
  ('Goodies Bake Shop', 'goodies-bake-shop', 'Bakery', 'West End', '1124 Ellice Ave, Winnipeg, MB'),
  ('Oh Doughnuts', 'oh-doughnuts', 'Bakery', 'River Heights', '1194 Taylor Ave, Unit 3, Winnipeg, MB'),
  ('Bronuts', 'bronuts', 'Bakery', 'Exchange District', '100 King St, Unit 3, Winnipeg, MB'),
  ('La Carnita', 'la-carnita', 'Tacos', 'Exchange District', '456 Main St, Winnipeg, MB'),
  ('Burrito Del Rio', 'burrito-del-rio', 'Tacos', 'Osborne Village', '433 River Ave, Unit 8, Winnipeg, MB'),
  ('Sargent Taco Shop', 'sargent-taco-shop', 'Tacos', 'West End', '698 Sargent Ave, Winnipeg, MB'),
  ('Carlos & Murphy''s', 'carlos-murphys', 'Tacos', 'Osborne Village', '129 Osborne St, Winnipeg, MB'),
  ('BMC Market', 'bmc-market', 'Tacos', 'Fort Rouge', '722 Osborne St, Winnipeg, MB'),
  ('La Roca', 'la-roca', 'Tacos', 'Downtown', '155 Smith St, Winnipeg, MB'),
  ('JC''s Tacos and More', 'jcs-tacos-and-more', 'Tacos', 'Elmwood', '187 Henderson Hwy, Winnipeg, MB'),
  ('Vera Pizza', 'vera-pizza', 'Pizza', 'Fort Rouge', '670 Osborne St, Winnipeg, MB'),
  ('Corrientes Argentine Pizzeria', 'corrientes-argentine-pizzeria', 'Pizza', 'Exchange District', '137 Bannatyne Ave, Winnipeg, MB'),
  ('Super Deluxe Pizzeria', 'super-deluxe-pizzeria', 'Pizza', 'Osborne Village', '433 River Ave, Unit 4, Winnipeg, MB'),
  ('Tommy''s Pizzeria', 'tommys-pizzeria', 'Pizza', 'Corydon', '842 Corydon Ave, Winnipeg, MB'),
  ('Pizzeria Gusto', 'pizzeria-gusto', 'Pizza', 'River Heights', '404 Academy Rd, Winnipeg, MB'),
  ('Santa Ana Pizzeria & Bistro', 'santa-ana-pizzeria-bistro', 'Pizza', 'St. Vital', '1631 St Mary''s Rd, Unit F, Winnipeg, MB'),
  ('Za Pizza Bistro', 'za-pizza-bistro', 'Pizza', 'St. Vital', '1220 St Mary''s Rd, Unit E, Winnipeg, MB'),
  ('A Little Pizza Heaven', 'a-little-pizza-heaven', 'Pizza', 'Osborne Village', '120 Osborne St, Winnipeg, MB'),
  ('Bonfire Bistro', 'bonfire-bistro', 'Pizza', 'River Heights', '1433 Corydon Ave, Winnipeg, MB'),
  ('Pasquale''s Italian Ristorante', 'pasquales-italian-ristorante', 'Pizza', 'St. Boniface', '109 Marion St, Winnipeg, MB'),
  ('Harth Mozza & Wine Bar', 'harth-mozza-wine-bar', 'Pizza', 'St. Vital', '980 St Anne''s Rd, Unit 1, Winnipeg, MB'),
  ('Kalan Restaurant', 'kalan-restaurant', 'Asian', 'North End', '1449 Arlington St, Winnipeg, MB'),
  ('Máquè', 'maque', 'Asian', 'Corydon', '909 Dorchester Ave, Winnipeg, MB'),
  ('Khao House', 'khao-house', 'Asian', 'Downtown', '625 Portage Ave, Winnipeg, MB'),
  ('Pho Hoang Osborne', 'pho-hoang-osborne', 'Asian', 'Osborne Village', '117 Osborne St, Winnipeg, MB'),
  ('One 777 Vietnamese Restaurant', 'one-777-vietnamese-restaurant', 'Asian', 'North End', '1777 Main St, Winnipeg, MB'),
  ('Clementine Café', 'clementine-cafe', 'Brunch', 'Exchange District', '123 Princess St, Winnipeg, MB'),
  ('Modern Electric Lunch', 'modern-electric-lunch', 'Brunch', 'Downtown', '232 Main St, Winnipeg, MB'),
  ('Juneberry', 'juneberry', 'Brunch', 'St. Vital', '531 St Mary''s Rd, Winnipeg, MB'),
  ('Wanabees Diner', 'wanabees-diner', 'Brunch', 'West Broadway', '639 Broadway, Winnipeg, MB'),
  ('The Nook', 'the-nook', 'Brunch', 'West Broadway', '43 Sherbrook St, Winnipeg, MB'),
  ('Two Kelly''s Café', 'two-kellys-cafe', 'Brunch', 'Downtown', '81 Garry St, Unit 3, Winnipeg, MB'),
  ('Buvette', 'buvette', 'Brunch', 'Osborne Village', '120 Scott St, Unit 2, Winnipeg, MB'),
  ('Pauline', 'pauline', 'Brunch', 'St. Boniface', '112 Marion St, Winnipeg, MB'),
  ('Park Café', 'park-cafe', 'Brunch', 'River Heights', '330 Assiniboine Park Dr, Winnipeg, MB'),
  ('Newcastle Restaurant', 'newcastle-restaurant', 'Brunch', 'North End', '1010 Main St, Winnipeg, MB'),
  ('La Crêperie Ker Breizh', 'la-creperie-ker-breizh', 'Brunch', 'West Broadway', '267 Sherbrook St, Winnipeg, MB'),
  ('Falafel Place', 'falafel-place', 'Brunch', 'Corydon', '1101 Corydon Ave, Winnipeg, MB'),
  ('Nathan Detroit''s Sandwich Pad', 'nathan-detroits-sandwich-pad', 'Brunch', 'Downtown', '1 Lombard Pl, Concourse Level, Winnipeg, MB'),
  ('Chaeban Ice Cream', 'chaeban-ice-cream', 'Dessert', 'Osborne Village', '390 Osborne St, Winnipeg, MB'),
  ('Nucci''s Gelati', 'nuccis-gelati', 'Dessert', 'Corydon', '643 Corydon Ave, Winnipeg, MB'),
  ('Eva''s Gelato & Coffee Bar', 'evas-gelato-coffee-bar', 'Dessert', 'Corydon', '1001 Corydon Ave, Unit 101, Winnipeg, MB'),
  ('BDI (Bridge Drive-In)', 'bdi-bridge-drive-in', 'Dessert', 'Fort Rouge', '766 Jubilee Ave, Winnipeg, MB'),
  ('Chocolatier Constance Popp', 'chocolatier-constance-popp', 'Dessert', 'St. Boniface', '180 Provencher Blvd, Winnipeg, MB'),
  ('Sargent Sundae', 'sargent-sundae', 'Dessert', 'St. James', '2053 Portage Ave, Winnipeg, MB'),
  ('Chocoberry Dessert House', 'chocoberry-dessert-house', 'Dessert', 'Osborne Village', '470 River Ave, Unit B, Winnipeg, MB'),
  ('Kawaii Crepe', 'kawaii-crepe', 'Dessert', 'Osborne Village', '99 Osborne St, Unit 201, Winnipeg, MB'),
  ('Baked Expectations', 'baked-expectations', 'Dessert', 'Osborne Village', '161 Osborne St, Winnipeg, MB'),
  ('Dairy Delight', 'dairy-delight', 'Dessert', 'St. Vital', '467 St Anne''s Rd, Winnipeg, MB'),
  ('VJ''s Drive Inn', 'vjs-drive-inn', 'Burgers', 'Downtown', '170 Main St, Winnipeg, MB'),
  ('Peasant Cookery', 'peasant-cookery', 'Bistro', 'Exchange District', '283 Bannatyne Ave, Winnipeg, MB'),
  ('Deer + Almond', 'deer-and-almond', 'Bistro', 'Exchange District', '85 Princess St, Winnipeg, MB'),
  ('Sous Sol', 'sous-sol', 'Bistro', 'Osborne Village', '222 Osborne St, Unit 22, Winnipeg, MB'),
  ('Passero', 'passero', 'Bistro', 'Corydon', '774 Corydon Ave, Winnipeg, MB'),
  ('Né de Loup', 'ne-de-loup', 'Bistro', 'River Heights', '1670 Corydon Ave, Winnipeg, MB'),
  ('Resto Gare Bistro', 'resto-gare-bistro', 'Bistro', 'St. Boniface', '630 Des Meurons St, Winnipeg, MB'),
  ('Inferno''s Bistro', 'infernos-bistro', 'Bistro', 'St. Boniface', '312 Des Meurons St, Winnipeg, MB'),
  ('Promenade Brasserie', 'promenade-brasserie', 'Bistro', 'St. Boniface', '130 Provencher Blvd, Unit C, Winnipeg, MB'),
  ('Feast Café Bistro', 'feast-cafe-bistro', 'Bistro', 'West End', '587 Ellice Ave, Winnipeg, MB'),
  ('SMITH Restaurant', 'smith-restaurant', 'Bistro', 'The Forks', '75 Forks Market Rd, Winnipeg, MB'),
  ('Cafe Carlo', 'cafe-carlo', 'Bistro', 'Corydon', '243 Lilac St, Winnipeg, MB'),
  ('Amsterdam Tea Room', 'amsterdam-tea-room', 'Bistro', 'Exchange District', '211 Bannatyne Ave, Unit 103, Winnipeg, MB'),
  ('King + Bannatyne', 'king-and-bannatyne', 'Bistro', 'Exchange District', '100 King St, Unit D, Winnipeg, MB'),
  ('Saperavi', 'saperavi', 'World', 'Corydon', '709 Corydon Ave, Winnipeg, MB'),
  ('Bistro Dansk', 'bistro-dansk', 'World', 'West Broadway', '63 Sherbrook St, Winnipeg, MB'),
  ('Next Stop Café', 'next-stop-cafe', 'World', 'Fort Rouge', '333 Pembina Hwy, Winnipeg, MB'),
  ('East India Company', 'east-india-company', 'World', 'Downtown', '349 York Ave, Winnipeg, MB')
  ) AS v(name, slug, category, neighbourhood, address)
ON CONFLICT (slug) DO NOTHING;
