-- ==========================================
-- PROJECT DIMORA: FULL SUPABASE MIGRATION (REVISED + PRE-BUILD AUDIT)
-- Canonical source: Dimora_README.md Section 4
-- ==========================================

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TYPE public.user_role AS ENUM ('hunter', 'agent', 'admin');
CREATE TYPE public.property_type AS ENUM ('apartment', 'house', 'bedsitter', 'townhouse', 'commercial', 'land');
CREATE TYPE public.verification_kind AS ENUM ('site_visit', 'title_deed', 'agent_id', 'registry_crosscheck');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE public.payment_purpose AS ENUM ('viewing_deposit', 'listing_boost', 'subscription', 'rent');
CREATE TYPE public.escrow_status AS ENUM ('held', 'released_to_agent', 'refunded_to_hunter', 'disputed');

-- 2. TABLES DEFINITION

-- PROFILES (Syncs with auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    phone_number TEXT,
    role public.user_role NOT NULL DEFAULT 'hunter',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- AGENT KYC
CREATE TABLE public.agent_kyc (
    agent_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    kra_pin TEXT,
    id_document_url TEXT,
    selfie_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PROPERTIES
CREATE TABLE public.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    type public.property_type NOT NULL,
    bedrooms INT NOT NULL DEFAULT 0,
    bathrooms INT NOT NULL DEFAULT 0,
    county TEXT NOT NULL,
    sub_county TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location GEOGRAPHY(Point, 4326),
    images TEXT[] NOT NULL DEFAULT '{}',
    is_published BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_properties_geo ON public.properties USING GIST (location);

-- PROPERTY VERIFICATIONS
CREATE TABLE public.property_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    kind public.verification_kind NOT NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    evidence_url TEXT,
    evidence_hash TEXT,
    evidence_captured_at TIMESTAMPTZ,
    evidence_latitude DOUBLE PRECISION,
    evidence_longitude DOUBLE PRECISION,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(property_id, kind)
);

-- BOOKINGS / VIEWING REQUESTS
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    hunter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status public.booking_status NOT NULL DEFAULT 'pending',
    hunter_confirmed_viewing BOOLEAN NOT NULL DEFAULT false,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- FAVORITES
CREATE TABLE public.favorites (
    hunter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (hunter_id, property_id)
);

-- AGENT WORKSPACE ITEMS (Leads, Tasks, CRM Notes)
CREATE TABLE public.agent_workspace_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lead_name TEXT,
    lead_phone TEXT,
    lead_source TEXT NOT NULL DEFAULT 'manual',
    whatsapp_thread_id TEXT,
    stage TEXT NOT NULL DEFAULT 'new_lead',
    notes TEXT,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- LISTING REPORTS (Trust & Safety)
CREATE TABLE public.property_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- REVIEWS (gated to completed bookings only)
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    hunter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- NEIGHBORHOOD SIGNALS
CREATE TABLE public.neighborhood_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    county TEXT NOT NULL,
    sub_county TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PAYMENTS (M-PESA Transactions)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_request_id TEXT NOT NULL,
    checkout_request_id TEXT NOT NULL UNIQUE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    purpose public.payment_purpose NOT NULL DEFAULT 'viewing_deposit',
    escrow_status public.escrow_status,
    phone_number TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    mpesa_receipt_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    raw_callback JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- RENT LEDGER
CREATE TABLE public.rent_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount_due NUMERIC(12, 2) NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'due',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- LISTING PERFORMANCE ANALYTICS
CREATE TABLE public.listing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. INDEXES
CREATE INDEX idx_properties_agent_id ON public.properties(agent_id);
CREATE INDEX idx_properties_published_verified ON public.properties(is_published, is_verified) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_location ON public.properties(county, sub_county, neighborhood);
CREATE INDEX idx_properties_price ON public.properties(price);
CREATE INDEX idx_verifications_property ON public.property_verifications(property_id);
CREATE INDEX idx_bookings_hunter ON public.bookings(hunter_id);
CREATE INDEX idx_bookings_agent ON public.bookings(agent_id);
CREATE INDEX idx_favorites_hunter ON public.favorites(hunter_id);
CREATE INDEX idx_agent_workspace_agent ON public.agent_workspace_items(agent_id);
CREATE INDEX idx_payments_checkout_id ON public.payments(checkout_request_id);
CREATE INDEX idx_rent_ledger_tenant ON public.rent_ledger(tenant_id);
CREATE INDEX idx_listing_events_property ON public.listing_events(property_id, event_type);

-- 4. AUTOMATED TRIGGERS & FUNCTIONS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- SECURITY: role is NEVER read from client-controlled raw_user_meta_data.
    -- Everyone signs up as 'hunter'; elevation happens only via a service-role admin flow.
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'hunter'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_properties_modtime BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_bookings_modtime BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_workspace_modtime BEFORE UPDATE ON public.agent_workspace_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_payments_modtime BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_property_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER sync_properties_location BEFORE INSERT OR UPDATE ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.sync_property_location();

CREATE OR REPLACE FUNCTION public.recompute_property_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    required_kinds public.verification_kind[] := ARRAY['site_visit', 'title_deed', 'agent_id'];
    present_count INT;
BEGIN
    SELECT COUNT(DISTINCT kind) INTO present_count
    FROM public.property_verifications
    WHERE property_id = NEW.property_id
      AND kind = ANY(required_kinds)
      AND verified_by IS NOT NULL;

    UPDATE public.properties
    SET is_verified = (present_count = array_length(required_kinds, 1))
    WHERE id = NEW.property_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_verification_upsert AFTER INSERT OR UPDATE ON public.property_verifications
    FOR EACH ROW EXECUTE FUNCTION public.recompute_property_verified();

CREATE OR REPLACE FUNCTION public.enforce_listing_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    active_count INT;
    free_tier_limit INT := 5;
BEGIN
    IF NEW.is_published IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO active_count
    FROM public.properties
    WHERE agent_id = NEW.agent_id AND is_published = true AND deleted_at IS NULL
      AND id IS DISTINCT FROM NEW.id;

    IF active_count >= free_tier_limit THEN
        RAISE EXCEPTION 'Free tier listing limit (%) reached. Upgrade to add more active listings.', free_tier_limit;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_listing_cap_trigger BEFORE INSERT OR UPDATE OF is_published, deleted_at ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_cap();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_workspace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhood_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- PROFILES
CREATE POLICY "Users can view their own full profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND COALESCE(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' THEN
        RAISE EXCEPTION 'Role changes are not permitted via client updates.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_profile_role BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

CREATE VIEW public.public_profiles AS
    SELECT id, full_name, avatar_url, role FROM public.profiles;

CREATE POLICY "Booking participants can view each other's contact info"
    ON public.profiles FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE (bookings.hunter_id = auth.uid() AND bookings.agent_id = profiles.id)
               OR (bookings.agent_id = auth.uid() AND bookings.hunter_id = profiles.id)
        )
    );

-- AGENT KYC
CREATE POLICY "Agents can create and view own KYC record"
    ON public.agent_kyc FOR INSERT WITH CHECK (auth.uid() = agent_id AND status = 'pending');
CREATE POLICY "Agents view own KYC record"
    ON public.agent_kyc FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Admins manage all KYC records"
    ON public.agent_kyc FOR UPDATE USING (public.get_auth_role() = 'admin');
CREATE POLICY "Admins read all KYC records"
    ON public.agent_kyc FOR SELECT USING (public.get_auth_role() = 'admin');

-- PROPERTIES
CREATE POLICY "Published, non-deleted properties are readable by everyone"
    ON public.properties FOR SELECT
    USING ((is_published = true AND deleted_at IS NULL) OR auth.uid() = agent_id);
CREATE POLICY "Agents can insert properties"
    ON public.properties FOR INSERT
    WITH CHECK (auth.uid() = agent_id AND public.get_auth_role() = 'agent');
CREATE POLICY "Agents can update own properties"
    ON public.properties FOR UPDATE USING (auth.uid() = agent_id);

-- PROPERTY VERIFICATIONS
CREATE POLICY "Only admins can read full verification records"
    ON public.property_verifications FOR SELECT USING (
        public.get_auth_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.properties
            WHERE properties.id = property_verifications.property_id
              AND properties.agent_id = auth.uid()
        )
    );

CREATE POLICY "Agents submit evidence for their own listings"
    ON public.property_verifications FOR INSERT WITH CHECK (
        verified_by IS NULL
        AND evidence_url IS NOT NULL
        AND evidence_hash IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.properties
            WHERE properties.id = property_verifications.property_id
              AND properties.agent_id = auth.uid()
        )
    );

CREATE POLICY "Owners update pending submissions, admins approve"
    ON public.property_verifications FOR UPDATE USING (
        public.get_auth_role() = 'admin'
        OR (
            verified_by IS NULL
            AND EXISTS (
                SELECT 1 FROM public.properties
                WHERE properties.id = property_verifications.property_id
                  AND properties.agent_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        public.get_auth_role() = 'admin'
        OR verified_by IS NULL
    );
CREATE POLICY "Only admins can write verifications"
    ON public.property_verifications FOR INSERT WITH CHECK (public.get_auth_role() = 'admin');

CREATE VIEW public.public_property_verifications AS
    SELECT property_id, kind, created_at FROM public.property_verifications
    WHERE verified_by IS NOT NULL;

-- BOOKINGS
CREATE POLICY "Hunters and Agents can view relevant bookings"
    ON public.bookings FOR SELECT
    USING (auth.uid() = hunter_id OR auth.uid() = agent_id);
CREATE POLICY "Hunters can create viewing requests"
    ON public.bookings FOR INSERT
    WITH CHECK (
        auth.uid() = hunter_id
        AND EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id
              AND p.agent_id = agent_id
              AND p.is_published = true
              AND p.deleted_at IS NULL
        )
    );
CREATE POLICY "Hunters and Agents can update relevant bookings"
    ON public.bookings FOR UPDATE
    USING (auth.uid() = hunter_id OR auth.uid() = agent_id);

-- FAVORITES
CREATE POLICY "Users can select own favorites"
    ON public.favorites FOR SELECT USING (auth.uid() = hunter_id);
CREATE POLICY "Users can insert own favorites"
    ON public.favorites FOR INSERT WITH CHECK (auth.uid() = hunter_id);
CREATE POLICY "Users can delete own favorites"
    ON public.favorites FOR DELETE USING (auth.uid() = hunter_id);

-- WORKSPACE
CREATE POLICY "Agents manage their own workspace items"
    ON public.agent_workspace_items FOR ALL
    USING (auth.uid() = agent_id AND public.get_auth_role() = 'agent');

-- REPORTS
CREATE POLICY "Authenticated users can create listing reports"
    ON public.property_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can view all reports"
    ON public.property_reports FOR SELECT USING (public.get_auth_role() = 'admin');

-- REVIEWS
CREATE POLICY "Reviews are publicly readable"
    ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Hunters can review only their own completed bookings"
    ON public.reviews FOR INSERT WITH CHECK (
        auth.uid() = hunter_id AND EXISTS (
            SELECT 1 FROM public.bookings
            WHERE bookings.id = reviews.booking_id
              AND bookings.hunter_id = auth.uid()
              AND bookings.status = 'completed'
        )
    );

-- NEIGHBORHOOD SIGNALS
CREATE POLICY "Neighborhood signals are publicly readable"
    ON public.neighborhood_signals FOR SELECT USING (true);
CREATE POLICY "Authenticated users can submit neighborhood signals"
    ON public.neighborhood_signals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- PAYMENTS
CREATE POLICY "Users view own payments"
    ON public.payments FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE bookings.id = payments.booking_id
            AND (bookings.hunter_id = auth.uid() OR bookings.agent_id = auth.uid())
        )
    );

-- RENT LEDGER
CREATE POLICY "Tenants view their own rent ledger"
    ON public.rent_ledger FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "Agents view rent ledgers for their properties"
    ON public.rent_ledger FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.properties WHERE properties.id = rent_ledger.property_id AND properties.agent_id = auth.uid())
    );

-- LISTING EVENTS
CREATE POLICY "Authenticated users can log a listing event"
    ON public.listing_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Agents view analytics for their own properties"
    ON public.listing_events FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.properties WHERE properties.id = listing_events.property_id AND properties.agent_id = auth.uid())
    );

-- STORAGE
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Agents upload to their own prefix"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'property-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Owners replace their own uploads"
    ON storage.objects FOR UPDATE TO authenticated
    USING ((storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read for listing images"
    ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
