-- Business verification: anyone can make a restaurant account and draft a page,
-- but nothing goes public (page, orders, drops, deals) until a Bite admin verifies the business.

ALTER TABLE public.restaurants
  ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  ADD COLUMN verified_at timestamptz;

-- Everything that exists today was set up by us, so it starts verified.
UPDATE public.restaurants SET verification_status = 'verified', verified_at = now();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_verified_restaurant(_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurants WHERE id = _restaurant_id AND verification_status = 'verified')
$$;
GRANT EXECUTE ON FUNCTION public.is_verified_restaurant(uuid) TO anon, authenticated;

-- Extends the 0003 guard (same trigger). It runs as the caller: direct app writes arrive as the
-- "authenticated" role, while the review RPCs below run as the table owner and may change status.
-- Owners can't verify themselves, extend their free period, or go live before verification.
CREATE OR REPLACE FUNCTION public.restaurants_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.free_until := now() + interval '3 months';
      NEW.verification_status := 'unverified';
      NEW.verified_at := NULL;
    ELSE
      NEW.free_until := OLD.free_until;
      NEW.verification_status := OLD.verification_status;
      NEW.verified_at := OLD.verified_at;
      NEW.owner_id := OLD.owner_id;
    END IF;
  END IF;
  IF NEW.verification_status <> 'verified' THEN
    NEW.is_active := false;
    NEW.accepting_orders := false;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.busy_level IS DISTINCT FROM OLD.busy_level OR NEW.wait_minutes IS DISTINCT FROM OLD.wait_minutes THEN
    NEW.busy_updated_at := CASE WHEN NEW.busy_level IS NULL AND NEW.wait_minutes IS NULL THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END $$;

-- Business tools need a verified restaurant.
CREATE POLICY "Drops need verified restaurant" ON public.drops AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_verified_restaurant(restaurant_id));
CREATE POLICY "Drops update need verified restaurant" ON public.drops AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_verified_restaurant(restaurant_id));
CREATE POLICY "Promotions need verified restaurant" ON public.promotions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_verified_restaurant(restaurant_id));
CREATE POLICY "Promotions update need verified restaurant" ON public.promotions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_verified_restaurant(restaurant_id));

-- Applications
CREATE TABLE public.business_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL DEFAULT auth.uid(),
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 120),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 80),
  contact_role text NOT NULL CHECK (contact_role IN ('owner', 'manager', 'other')),
  business_phone text NOT NULL CHECK (char_length(business_phone) BETWEEN 7 AND 25),
  business_email text CHECK (business_email IS NULL OR char_length(business_email) <= 120),
  website text CHECK (website IS NULL OR char_length(website) <= 200),
  business_number text CHECK (business_number IS NULL OR char_length(business_number) <= 40),
  permit_number text CHECK (permit_number IS NULL OR char_length(permit_number) <= 40),
  doc_paths text[] NOT NULL DEFAULT '{}' CHECK (cardinality(doc_paths) BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text CHECK (admin_note IS NULL OR char_length(admin_note) <= 500),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.business_verifications (restaurant_id, created_at DESC);
CREATE UNIQUE INDEX business_verifications_one_pending ON public.business_verifications (restaurant_id) WHERE status = 'pending';
ALTER TABLE public.business_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_verifications FROM anon, authenticated;
GRANT SELECT ON public.business_verifications TO authenticated;
GRANT ALL ON public.business_verifications TO service_role;
CREATE POLICY "Owners see own applications, admins see all" ON public.business_verifications FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.owns_restaurant(restaurant_id) OR public.is_admin());

CREATE OR REPLACE FUNCTION public.submit_verification(
  p_restaurant_id uuid, p_legal_name text, p_contact_name text, p_contact_role text, p_business_phone text,
  p_business_email text, p_website text, p_business_number text, p_permit_number text, p_doc_paths text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_status text; p text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT verification_status INTO v_status FROM public.restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Set up your restaurant page first'; END IF;
  IF v_status = 'verified' THEN RAISE EXCEPTION 'Your restaurant is already verified'; END IF;
  IF v_status = 'pending' THEN RAISE EXCEPTION 'We''re already reviewing your application'; END IF;
  IF coalesce(cardinality(p_doc_paths), 0) = 0 THEN RAISE EXCEPTION 'Add at least one document'; END IF;
  FOREACH p IN ARRAY p_doc_paths LOOP
    IF split_part(p, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'Upload your documents again'; END IF;
  END LOOP;
  INSERT INTO public.business_verifications (restaurant_id, submitted_by, legal_name, contact_name, contact_role,
      business_phone, business_email, website, business_number, permit_number, doc_paths)
    VALUES (p_restaurant_id, auth.uid(), trim(p_legal_name), trim(p_contact_name), p_contact_role, trim(p_business_phone),
      nullif(trim(p_business_email), ''), nullif(trim(p_website), ''), nullif(trim(p_business_number), ''),
      nullif(trim(p_permit_number), ''), p_doc_paths)
    RETURNING id INTO v_id;
  UPDATE public.restaurants SET verification_status = 'pending' WHERE id = p_restaurant_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_verification(uuid, text, text, text, text, text, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_verification(uuid, text, text, text, text, text, text, text, text, text[]) TO authenticated;

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
  -- The 3 free months start the day they're verified, not the day they signed up.
  UPDATE public.restaurants
     SET verification_status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END,
         verified_at = CASE WHEN p_approve THEN now() ELSE NULL END,
         free_until = CASE WHEN p_approve THEN now() + interval '3 months' ELSE free_until END,
         is_active = p_approve,
         accepting_orders = p_approve
   WHERE id = v.restaurant_id;
END $$;
REVOKE ALL ON FUNCTION public.review_verification(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_verification(uuid, boolean, text) TO authenticated;

-- Admin queue with the restaurant attached
CREATE OR REPLACE FUNCTION public.verification_queue()
RETURNS TABLE (id uuid, restaurant_id uuid, restaurant_name text, restaurant_slug text, restaurant_address text,
  restaurant_phone text, owner_email text, legal_name text, contact_name text, contact_role text, business_phone text,
  business_email text, website text, business_number text, permit_number text, doc_paths text[], status text,
  admin_note text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT v.id, r.id, r.name, r.slug, r.address, r.phone, u.email::text, v.legal_name, v.contact_name, v.contact_role,
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

-- Private documents: owners upload into their own folder; only they and admins can read them.
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Verification docs upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Verification docs read own or admin" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'verification-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
