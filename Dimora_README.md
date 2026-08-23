# DIMORA — Kenyan Proptech (Freemium SaaS PWA)

Dimora is a mobile-first, offline-first Progressive Web Application (PWA) tailored specifically for house hunters and real estate agents in Kenya. Built to address local network reliability challenges, low-end device constraints, and high market fragmentation, Dimora combines a **Trust & Verification Engine**, **Agent CRM Workspace**, **Escrow-Protected Payments**, and **Offline Synchronization** powered by Supabase and M-PESA integration.

> **Note on this revision**: This document supersedes the original Dimora spec. It folds in four planned improvement passes (security hardening, design system overhaul, a new differentiating feature set, and a pre-build audit that closes privilege-escalation holes, defines escrow settlement/refund semantics, adds storage/KYC/offline-idempotency scaffolding, and pins Kenya DPA 2018 compliance), and flags a landlord module as a deliberate future consideration rather than in-scope work. Build against this document in the order the sections appear — later sections depend on schema and security decisions made earlier.

---

## 0. Build Priority Order

When implementing this spec, work in this order — each phase depends on the one before it:

1. **Phase 1 — Core schema & auth** (Section 4): tables, RLS, roles.
2. **Phase 2 — Secure payments** (Section 6): M-PESA edge functions, hardened from the start per Section 6's security requirements. Do not ship the naive version and harden later — build it secure the first time.
3. **Phase 3 — Offline sync** (Section 5).
4. **Phase 4 — Design system** (Section 3): palette, type, icons, signature element.
5. **Phase 5 — Differentiating features** (Section 9): trust upgrades, escrow, WhatsApp CRM, etc. — build after the core loop (browse → verify → book → pay) works end to end.
6. **Not in scope yet — Landlord module** (Section 10): explicitly deferred. Leave extension points, do not build the feature.

---

## 1. Executive Summary & Core Mission

### Vision
To redefine the real estate experience in Kenya by delivering a lightweight, fast, and trustworthy digital platform that operates seamlessly across all network conditions — from fast 5G in Kilimani to erratic 3G connections across rural counties.

### Core Differentiators
1. **Trust Engine**: Verified listings validated through site inspections, title deed checks, and agent identity verification (KRA PIN / National ID) — with a path toward provable, not just claimed, verification (see Section 9.1).
2. **Offline-First Capabilities**: Full read/write functionality when offline using Service Workers, IndexedDB, and Background Sync queueing (real Background Sync API, not just `window online` listeners — see Section 5).
3. **Kenya-Optimized Workflows**: Native M-PESA STK Push payment integration, WhatsApp one-tap agent routing (and WhatsApp-native lead capture, Section 9.3), and localized property taxonomies.
4. **Agent Workspace**: Freemium SaaS CRM providing lead tracking, inventory management, verification requests, and listing performance analytics.
5. **Escrow-Protected Bookings**: Viewing deposits held in escrow and released only on confirmed viewing, directly targeting the market's most common scam pattern (fake agents collecting viewing fees and disappearing).

---

## 2. System Architecture & Tech Stack

```
                                  +---------------------------------------+
                                  |            DIMORA PWA CLIENT          |
                                  | (React 18 + TS + Tailwind + PWA)       |
                                  +-------------------+-------------------+
                                                      |
                                    +-----------------+-----------------+
                                    |                                   |
                             [ Online Mode ]                    [ Offline Mode ]
                                    |                                   |
                                    v                                   v
                         +--------------------+              +--------------------+
                         | Supabase Client    |              | IndexedDB Engine   |
                         | (REST / Realtime)  |              | (idb Helper)       |
                         +----------+---------+              +----------+---------+
                                    |                                   |
                                    |                        +----------+----------+
                                    |                        | Offline Sync Queue  |
                                    |                        | (Background Sync)   |
                                    |                        +----------+----------+
                                    |                                   |
                                    +-----------------+-----------------+
                                                      | (Auto-Sync on Reconnect,
                                                      |  fires even if app closed)
                                                      v
                                        +----------------------------+
                                        |  SUPABASE BACKEND CLOUD    |
                                        +----------------------------+
                                        | - PostgreSQL DB + RLS      |
                                        | - Auth (Magic Link/OAuth)  |
                                        | - Edge Functions           |
                                        +--------------+-------------+
                                                       |
                                  +--------------------+--------------------+
                                  |                    |                    |
                                  v                    v                    v
                          +---------------+   +---------------+   +----------------+
                          | Daraja API    |   | WhatsApp API  |   | SMS Gateway    |
                          | (M-PESA Push, |   | (Lead Capture |   | (Fallback for  |
                          | Escrow logic) |   | + Direct Chat)|   | critical events)|
                          +---------------+   +---------------+   +----------------+
```

### Core Architecture Specifications
- **Framework**: React 18 with TypeScript, bundled with Vite.
- **Styling**: Tailwind CSS 3 using custom design tokens (see Section 3 for the revised token system — do not use generic default spacing/color tokens).
- **PWA Integration**: `vite-plugin-pwa` with custom Service Worker caching static assets, API payloads, **and listing images** (see Section 5.3 — image caching was missing from the original spec and matters most on the exact low-bandwidth connections this app targets).
- **Offline Storage**: `idb` wrapper over IndexedDB with an LRU cache eviction strategy (max 50 listings) and queued mutation handling, synced via the real **Background Sync API**, not just online/offline window events.
- **Backend & Auth**: Supabase Backend-as-a-Service (PostgreSQL, Row Level Security, Edge Functions, Auth).
- **Payments**: Safaricom M-PESA Daraja API (STK Push) via Supabase Edge Functions, hardened with request verification, idempotency, and server-side amount authority (Section 6).
- **Messaging**: WhatsApp Business API for lead capture into the CRM (Section 9.3); SMS gateway (e.g. Africa's Talking) for critical-event fallback (Section 9.6).
- **Performance budget (binding, new)**: ≤200 KB gzipped initial JavaScript; Time-to-Interactive < 3 s on a mid-range Android over Fast 3G; Lighthouse PWA and Accessibility scores ≥ 90. The build fails CI if any budget is exceeded — "lightweight" is the core thesis, so it gets numbers, not adjectives.
- **Search implementation (new)**: keyword search = Postgres trigram (`pg_trgm`) + full-text over title/neighborhood/county with structured filters; no external search service at MVP scale (see Section 9.2).

---

## 3. Design System & Dimora Aesthetic (Revised)

### 3.0 Design Direction Rationale

The original palette (warm cream `#F8F6F1` + bright terracotta `#C87A4F` + Playfair Display) is one of the most common AI-generated default looks right now — warm neutral background, high-contrast serif, clay accent. It isn't *wrong* for a Kenyan brand (terracotta has real local resonance — murram roads, clay, earth), but as originally specified it reads as templated rather than deliberate. The revision below keeps the terracotta thesis but grounds every choice in something concrete: the actual materials of Kenyan homes, the seriousness of the transaction being made, and the distinct needs of hunters vs. agents.

Build to this revised system, not the original palette.

### 3.1 Color Palette (Revised)

| Token Name | Hex Code | Purpose / Usage | Rationale |
| :--- | :--- | :--- | :--- |
| **Primary (BG)** | `#EDE6D6` | Warm limewash/plaster background across hunter-facing containers | Evokes actual plastered walls of listed homes, not a generic SaaS cream |
| **Foreground** | `#1C1C1C` | High-contrast charcoal text and primary headings | Kept from original — works well for legibility on low-res displays |
| **Accent (Buttons)** | `#A85A38` | Dustier, murram/laterite-toned terracotta for primary CTAs, active toggles, primary badges | Pushed darker and dustier than the original `#C87A4F` to read as soil/clay rather than a generic warm-app accent |
| **Accent Hover** | `#8F4A2C` | Darker terracotta hover/active states | — |
| **Verified Mark** | `#3F6E64` | Desaturated teal-green for the Verified Badge specifically | Reads as an official ink-stamp color rather than "a nice sage accent" |
| **Agent Workspace (BG)** | `#1F2937` (indigo-leaning charcoal) | Background/chrome for the Agent CRM workspace only | Gives agents a visually distinct "mode" from the hunter-facing browse experience — currently the spec shares one palette across both, which flattens the two very different jobs-to-be-done |
| **Border / Muted** | `#DDD4C2` | Subtle divider lines and card borders | Adjusted to sit correctly against the new background |

### 3.2 Typography & Hierarchy (Revised)

- **Display Font**: **Fraunces** (a serif with structural confidence and warmth, but sturdier and less fashion-editorial than Playfair Display) — used with restraint, primarily for property titles and section headers.
  - Alternative if a sans display is preferred: **Space Grotesk**.
  - *Rationale*: Playfair Display's elegance reads as boutique-hotel/fashion-magazine. Dimora is a trust-and-verification tool for a major financial decision, often used on a low-end Android over 3G — it needs a display face with institutional confidence, not editorial delicacy.
- **Body Font**: `Inter` (sans-serif, highly legible on low-resolution displays) — unchanged from original, this was already the right pragmatic choice.
- **Price/Numeral Treatment**: prices get their **own distinct numeric voice** — tabular figures, slightly larger than surrounding body text, weight-differentiated from headings. Price is the single most-scanned field on a property card; it should be visually locked onto before anything else.
- **H1 Titles**: `text-3xl font-bold font-display`
- **H2 Headings**: `text-xl font-semibold font-display`
- **Body Text**: `text-sm font-sans text-neutral-800`
- **Caption / Meta**: `text-xs font-sans text-neutral-500`
- **Price**: `text-lg font-semibold font-sans tabular-nums text-[#1C1C1C]` (new token — not present in original spec)

### 3.3 Icon System (New)

The original spec had no icon system defined — this is a gap since off-the-shelf icon packs (Feather, Heroicons, generic Material icons) will make Dimora look like every other SaaS dashboard.

- **Custom icon set required for**: the four trust badges (site-visit verified, title-deed verified, agent-ID verified, and the composite "Dimora Verified" mark), and the six property-type categories (apartment, house, bedsitter, townhouse, commercial, land). These are the actual product differentiators and deserve bespoke glyphs — not generic checkmarks or stock house icons.
- **Neutral/stock icon set acceptable for**: nav chrome, UI controls (close, back, menu, search). Don't over-invest design effort here — spend it where it's earned, per the principle of spending boldness in one place.

### 3.4 Signature Element (New)

The original spec had no defined signature element. Make the **Verified Badge** the one deliberately bold, memorable element in the app, since verification is Dimora's actual thesis. Give it real presence:
- A distinct stamp/seal-like shape (not a generic green pill or checkmark).
- A subtle ink-stamp texture effect.
- Consistent rendering across property card, property detail page, and agent profile.
- Everything else in the UI (cards, buttons, nav) stays quiet and disciplined around this one signature element.

### 3.5 Structural Styling Rules

- **Cards**: Background `#FFFFFF`, rounded edges `rounded-xl`, warm ambient shadow `shadow-lg` (`rgba(0,0,0,0.05)`).
- **Mobile Margins**: Mandatory `px-4` horizontal padding on mobile viewports.
- **Layout differentiation (new)**:
  - **Hunter-facing pages** (`Home`, `Search`, `PropertyDetail`): stay `max-w-md` centered even on desktop — reinforces that house-hunting is a mobile-first, on-the-go activity.
  - **Agent Workspace / CRM pages** (`Dashboard`, `LeadKanban`): expand to full desktop width on larger viewports. Agents plausibly manage leads from a laptop; don't force CRM data into a phone-width column on desktop just for visual consistency with the hunter side.
- **Accessibility floor** (non-negotiable, per design skill best practice): responsive down to mobile, visible keyboard focus states, respects `prefers-reduced-motion`.

---

## 4. Full Supabase Database Schema & RLS Policies (Revised)

Execute the following SQL script in your Supabase SQL Editor to initialize all tables, custom types, automated triggers, and Row Level Security policies. This revises the original schema to add: a proper verification join table, PostGIS geo support, freemium listing-cap enforcement, soft-delete on properties, an escrow-aware payment model, and idempotency/security-conscious defaults.

```sql
-- ==========================================
-- PROJECT DIMORA: FULL SUPABASE MIGRATION (REVISED)
-- ==========================================

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- required for proximity/commute search (Section 9.2)

-- NOTE: 'landlord' is intentionally NOT added to user_role yet.
-- See Section 10 — schema should not foreclose adding it later, but do not build the role now.
CREATE TYPE public.user_role AS ENUM ('hunter', 'agent', 'admin');
CREATE TYPE public.property_type AS ENUM ('apartment', 'house', 'bedsitter', 'townhouse', 'commercial', 'land');
CREATE TYPE public.verification_kind AS ENUM ('site_visit', 'title_deed', 'agent_id', 'registry_crosscheck');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE public.payment_purpose AS ENUM ('viewing_deposit', 'listing_boost', 'subscription', 'rent'); -- NEW: distinguishes payment types now that escrow + rent + boosts exist
CREATE TYPE public.escrow_status AS ENUM ('held', 'released_to_agent', 'refunded_to_hunter', 'disputed'); -- NEW

-- 2. TABLES DEFINITION

-- PROFILES (Syncs with auth.users)
-- NOTE: public SELECT policy on this table has been split — see RLS section.
-- Do not re-introduce a blanket "public profiles viewable by everyone" policy,
-- it previously exposed every user's email and phone_number to anyone.
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

-- AGENT KYC (NEW — identity verification is platform-level, not per-property)
-- The trust thesis depends on verified agent identity (KRA PIN / National ID), yet the
-- original schema only modeled per-property 'agent_id' verification. This stores each
-- agent's identity once; property-level agent verification references it.
CREATE TABLE public.agent_kyc (
    agent_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    kra_pin TEXT,
    id_document_url TEXT, -- PRIVATE bucket reference; never publicly readable
    selfie_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'verified' | 'rejected'
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
    location GEOGRAPHY(Point, 4326), -- NEW: enables proximity/commute-aware search (Section 9.2)
    images TEXT[] NOT NULL DEFAULT '{}',
    is_published BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false, -- becomes true only when required verification_kinds are all present, via trigger
    deleted_at TIMESTAMPTZ, -- NEW: soft-delete instead of hard cascade, preserves history for trust/dispute investigations
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_properties_geo ON public.properties USING GIST (location);

-- PROPERTY VERIFICATIONS (NEW — replaces the single verification_type/verified_at columns)
-- Rationale: the original schema modeled verification as one enum column, but the product's
-- own trust thesis requires site_visit AND title_deed AND agent_id to be tracked independently,
-- each with its own evidence, verifier, and timestamp — not mutually exclusive states.
CREATE TABLE public.property_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    kind public.verification_kind NOT NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- admin or field verifier
    evidence_url TEXT, -- photo/video/document proof
    evidence_hash TEXT, -- NEW: tamper-evident hash of evidence (Section 9.1)
    evidence_captured_at TIMESTAMPTZ, -- timestamp asserted by the evidence itself (e.g. photo EXIF/GPS time)
    evidence_latitude DOUBLE PRECISION, -- NEW: geo-lock so site-visit proof must match property location (Section 9.1)
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
    hunter_confirmed_viewing BOOLEAN NOT NULL DEFAULT false, -- NEW: required for escrow release (Section 9.2)
    idempotency_key TEXT UNIQUE, -- NEW: client-generated key (crypto.randomUUID()) so Background Sync retries never double-insert a booking
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
    lead_source TEXT NOT NULL DEFAULT 'manual', -- NEW: 'manual' | 'whatsapp' — supports Section 9.3
    whatsapp_thread_id TEXT, -- NEW: links to WhatsApp Business API conversation
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

-- REVIEWS (NEW — gated to completed bookings only, Section 9.1)
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    hunter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- NEIGHBORHOOD SIGNALS (NEW — Section 9.2)
CREATE TABLE public.neighborhood_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    county TEXT NOT NULL,
    sub_county TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    signal_type TEXT NOT NULL, -- e.g. 'water_reliability', 'security', 'transport_access'
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PAYMENTS (M-PESA Transactions) — REVISED to support escrow, boosts, subscriptions, rent
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_request_id TEXT NOT NULL,
    checkout_request_id TEXT NOT NULL UNIQUE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    purpose public.payment_purpose NOT NULL DEFAULT 'viewing_deposit', -- NEW
    escrow_status public.escrow_status, -- NEW: only populated when purpose = 'viewing_deposit'
    phone_number TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    mpesa_receipt_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    failure_reason TEXT,
    raw_callback JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- RENT LEDGER (NEW — Section 9.4, scoped to tenant<->agent/property, NOT a landlord entity yet)
CREATE TABLE public.rent_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- a 'hunter' who became a tenant
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount_due NUMERIC(12, 2) NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'due', -- 'due', 'paid', 'late', 'partial'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- LISTING PERFORMANCE ANALYTICS (NEW — Section 9.3)
CREATE TABLE public.listing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'view', 'save', 'whatsapp_click'
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
    -- SECURITY (revised): role is NEVER read from client-controlled raw_user_meta_data.
    -- Previously anyone could self-register as admin via { data: { role: 'admin' } }.
    -- Everyone signs up as 'hunter'; elevation to 'agent'/'admin' happens only through
    -- a service-role admin flow.
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

CREATE OR REPLACE TRIGGER on_auth_user_created
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

-- NEW: keep location GEOGRAPHY column in sync with latitude/longitude
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

-- NEW: recompute is_verified when all required verification kinds are present
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
    WHERE property_id = NEW.property_id AND kind = ANY(required_kinds);

    UPDATE public.properties
    SET is_verified = (present_count = array_length(required_kinds, 1))
    WHERE id = NEW.property_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_verification_upsert AFTER INSERT OR UPDATE ON public.property_verifications
    FOR EACH ROW EXECUTE FUNCTION public.recompute_property_verified();

-- NEW: enforce freemium listing cap (e.g. 5 active listings for free-tier agents)
-- Adjust FREE_TIER_LIMIT and the subscription-check join as your billing model firms up.
CREATE OR REPLACE FUNCTION public.enforce_listing_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    active_count INT;
    free_tier_limit INT := 5;
BEGIN
    SELECT COUNT(*) INTO active_count
    FROM public.properties
    WHERE agent_id = NEW.agent_id AND is_published = true AND deleted_at IS NULL
      AND id IS DISTINCT FROM NEW.id;

    -- Placeholder: replace this with a real subscription-status check once billing exists.
    IF active_count >= free_tier_limit THEN
        RAISE EXCEPTION 'Free tier listing limit (%) reached. Upgrade to add more active listings.', free_tier_limit;
    END IF;

    RETURN NEW;
END;
$$;

-- REVISED: fires on UPDATE too. Previously only INSERT was checked, so an agent could
-- unpublish a listing past the cap and republish it later to evade the limit.
CREATE TRIGGER enforce_listing_cap_trigger BEFORE INSERT OR UPDATE OF is_published, deleted_at ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_cap();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
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
-- REVISED: no more blanket "viewable by everyone" policy — it leaked email/phone_number.
-- Public-safe fields (name, avatar, role) are exposed via a view; contact info is
-- restricted to participants in a shared booking.
CREATE POLICY "Users can view their own full profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- SECURITY (revised): the blanket self-update policy previously allowed a hunter to
-- PATCH their own role to 'admin'. Role changes are now only possible from a
-- service-role context (edge functions); all client-side role mutations are blocked.
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

-- PROPERTIES
CREATE POLICY "Published, non-deleted properties are readable by everyone"
    ON public.properties FOR SELECT
    USING ((is_published = true AND deleted_at IS NULL) OR auth.uid() = agent_id);
CREATE POLICY "Agents can insert properties"
    ON public.properties FOR INSERT
    WITH CHECK (auth.uid() = agent_id AND public.get_auth_role() = 'agent');
CREATE POLICY "Agents can update own properties"
    ON public.properties FOR UPDATE USING (auth.uid() = agent_id);
-- REVISED: no hard DELETE policy — deletion happens via soft-delete (UPDATE deleted_at),
-- covered by the update policy above. This preserves history for trust/dispute investigations.

-- PROPERTY VERIFICATIONS
-- REVISED: the blanket public SELECT exposed evidence_url (title-deed scans, site
-- photos, possibly people) to the entire world. Full records — including evidence —
-- are admin-only now; clients read badge-relevant columns via the public view.
CREATE POLICY "Only admins can read full verification records"
    ON public.property_verifications FOR SELECT USING (public.get_auth_role() = 'admin');
CREATE POLICY "Only admins can write verifications"
    ON public.property_verifications FOR INSERT WITH CHECK (public.get_auth_role() = 'admin');

CREATE VIEW public.public_property_verifications AS
    SELECT property_id, kind, created_at FROM public.property_verifications;

-- BOOKINGS
CREATE POLICY "Hunters and Agents can view relevant bookings"
    ON public.bookings FOR SELECT
    USING (auth.uid() = hunter_id OR auth.uid() = agent_id);
CREATE POLICY "Hunters can create viewing requests"
    ON public.bookings FOR INSERT
    WITH CHECK (
        auth.uid() = hunter_id
        -- REVISED: agent_id must actually belong to the booked property, and the property
        -- must be live — prevents forged bookings pointing at an arbitrary agent_id.
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

-- REVIEWS (NEW — gated to completed bookings only)
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

-- NEIGHBORHOOD SIGNALS (NEW)
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
-- NOTE: all INSERT/UPDATE on payments happens exclusively via the service-role edge functions
-- (Section 6), never directly from the client. No client-facing INSERT/UPDATE policy is defined
-- on purpose.

-- RENT LEDGER (NEW)
CREATE POLICY "Tenants view their own rent ledger"
    ON public.rent_ledger FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "Agents view rent ledgers for their properties"
    ON public.rent_ledger FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.properties WHERE properties.id = rent_ledger.property_id AND properties.agent_id = auth.uid())
    );

-- LISTING EVENTS (NEW)
-- REVISED: was INSERT WITH CHECK (true), which let anonymous keys spam events and
-- inflate the analytics that feed the boost upsell. Auth required, plus application-level
-- rate limiting (edge function or Supabase rate limits) as a second layer.
CREATE POLICY "Authenticated users can log a listing event"
    ON public.listing_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Agents view analytics for their own properties"
    ON public.listing_events FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.properties WHERE properties.id = listing_events.property_id AND properties.agent_id = auth.uid())
    );

-- AGENT KYC (NEW)
ALTER TABLE public.agent_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can create and view own KYC record"
    ON public.agent_kyc FOR INSERT WITH CHECK (auth.uid() = agent_id AND status = 'pending');
CREATE POLICY "Agents view own KYC record"
    ON public.agent_kyc FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Admins manage all KYC records"
    ON public.agent_kyc FOR UPDATE USING (public.get_auth_role() = 'admin');
CREATE POLICY "Admins read all KYC records"
    ON public.agent_kyc FOR SELECT USING (public.get_auth_role() = 'admin');

-- STORAGE (NEW — the original spec defined images TEXT[] but never set up a bucket
-- or upload rules). Agents may write only under their own folder prefix; listing
-- images are publicly readable; size/format limits are enforced client-side plus in
-- the ListingForm edge validation (max ~2 MB, jpeg/png/webp) before upload.
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Agents upload to their own prefix"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'property-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Public read for listing images"
    ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
```

---

## 5. Offline Caching Engine & Queue Manager (Revised)

### 5.1 `src/lib/indexedDB.ts`
Manages client-side storage, LRU caching eviction (max 50 listings), and action queueing when disconnected. Unchanged in substance from the original spec — this part was already solid.

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface PropertyCache {
  id: string;
  title: string;
  price: number;
  county: string;
  sub_county: string;
  neighborhood: string;
  images: string[];
  type: string;
  bedrooms: number;
  bathrooms: number;
  is_verified: boolean;
  cachedAt: number;
}

export interface OfflineAction {
  id?: number;
  type: 'BOOKING_REQUEST' | 'TOGGLE_FAVORITE';
  payload: Record<string, any>;
  timestamp: number;
  retryCount: number; // NEW: caps retries so a permanently-failing item doesn't loop forever
}

interface DimoraDB extends DBSchema {
  cached_properties: {
    key: string;
    value: PropertyCache;
    indexes: { 'by-cachedAt': number };
  };
  sync_queue: {
    key: number;
    value: OfflineAction;
  };
}

const DB_NAME = 'dimora-offline-db';
const DB_VERSION = 1;
const MAX_CACHED_PROPERTIES = 50;
const MAX_RETRY_COUNT = 5; // NEW

export async function getDB(): Promise<IDBPDatabase<DimoraDB>> {
  return openDB<DimoraDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cached_properties')) {
        const propStore = db.createObjectStore('cached_properties', { keyPath: 'id' });
        propStore.createIndex('by-cachedAt', 'cachedAt');
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function cacheProperty(property: Omit<PropertyCache, 'cachedAt'>): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cached_properties', 'readwrite');
  const store = tx.objectStore('cached_properties');

  await store.put({ ...property, cachedAt: Date.now() });

  const index = store.index('by-cachedAt');
  const allKeys = await index.getAllKeys();

  if (allKeys.length > MAX_CACHED_PROPERTIES) {
    const keysToDelete = allKeys.slice(0, allKeys.length - MAX_CACHED_PROPERTIES);
    for (const key of keysToDelete) {
      await store.delete(key);
    }
  }
  await tx.done;
}

export async function getCachedProperty(id: string): Promise<PropertyCache | undefined> {
  const db = await getDB();
  return db.get('cached_properties', id);
}

export async function getAllCachedProperties(): Promise<PropertyCache[]> {
  const db = await getDB();
  return db.getAll('cached_properties');
}

export async function enqueueOfflineAction(
  type: OfflineAction['type'],
  payload: Record<string, any>
): Promise<number> {
  const db = await getDB();
  return db.add('sync_queue', { type, payload, timestamp: Date.now(), retryCount: 0 });
}

export async function getSyncQueue(): Promise<OfflineAction[]> {
  const db = await getDB();
  return db.getAll('sync_queue');
}

export async function clearQueueItem(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('sync_queue', id);
}

// NEW: increments retry count; moves item to a dead-letter state instead of failing silently forever
export async function incrementRetryOrDeadLetter(id: number): Promise<'retrying' | 'dead-lettered'> {
  const db = await getDB();
  const item = await db.get('sync_queue', id);
  if (!item) return 'retrying';

  const nextRetryCount = item.retryCount + 1;
  if (nextRetryCount >= MAX_RETRY_COUNT) {
    // Surface to the UI via a toast/banner rather than an endless console error loop.
    await db.delete('sync_queue', id);
    return 'dead-lettered';
  }

  await db.put('sync_queue', { ...item, retryCount: nextRetryCount });
  return 'retrying';
}
```

### 5.2 Background Sync (Revised — real Background Sync API, not just window events)

The original spec relied on `window.addEventListener('online', ...)`, which only flushes the queue while the app is open in a tab. This defeats a core PWA promise — a booking request made offline should sync even if the user closed the app before reconnecting. Register a real Background Sync event in the service worker.

`src/service-worker.ts` (relevant excerpt):

```typescript
// Registered from the client when an action is queued:
// await navigator.serviceWorker.ready.then(reg => reg.sync.register('dimora-sync-queue'));

self.addEventListener('sync', (event: any) => {
  if (event.tag === 'dimora-sync-queue') {
    event.waitUntil(processSyncQueueFromServiceWorker());
  }
});

async function processSyncQueueFromServiceWorker() {
  // Reuses the same getSyncQueue/clearQueueItem/incrementRetryOrDeadLetter logic
  // from src/lib/indexedDB.ts, invoked from the service worker context so it can
  // run even if no tab is open.
}
```

`src/hooks/useOfflineSync.ts` (revised): keep the existing `online`/`offline` listeners as an in-app fallback/immediate-feedback layer, but the source of truth for reliability is the Background Sync registration above, plus the retry/dead-letter handling from Section 5.1.

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getSyncQueue, clearQueueItem, incrementRetryOrDeadLetter } from '@/lib/indexedDB';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [deadLetteredCount, setDeadLetteredCount] = useState<number>(0); // NEW: drives a user-visible "couldn't sync" toast

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) processSyncQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function processSyncQueue() {
    const queue = await getSyncQueue();
    if (queue.length === 0 || isSyncing) return;
    setIsSyncing(true);

    for (const item of queue) {
      try {
        if (!item.id) continue;
        switch (item.type) {
          case 'BOOKING_REQUEST':
            await handleBookingSync(item.payload);
            break;
          case 'TOGGLE_FAVORITE':
            await handleFavoriteSync(item.payload);
            break;
        }
        await clearQueueItem(item.id);
      } catch (err) {
        const result = await incrementRetryOrDeadLetter(item.id!);
        if (result === 'dead-lettered') {
          setDeadLetteredCount((c) => c + 1); // surface via toast in the UI layer
        }
        console.error(`Sync failed for item [ID: ${item.id}]:`, err);
      }
    }
    setIsSyncing(false);
  }

  async function handleBookingSync(payload: any) {
    const { data: prop, error: propError } = await supabase
      .from('properties')
      .select('is_published')
      .eq('id', payload.property_id)
      .single();

    if (propError || !prop?.is_published) {
      console.warn(`Booking cancelled: Property ${payload.property_id} no longer active.`);
      return;
    }

    const { error } = await supabase.from('bookings').insert({
      property_id: payload.property_id,
      hunter_id: payload.hunter_id,
      agent_id: payload.agent_id,
      scheduled_at: payload.scheduled_at,
      notes: payload.notes,
      idempotency_key: payload.idempotency_key, // NEW: generated at enqueue time (crypto.randomUUID()); UNIQUE constraint makes retries no-ops
    });

    if (error) throw error;
  }

  async function handleFavoriteSync(payload: any) {
    if (payload.action === 'ADD') {
      const { error } = await supabase.from('favorites').upsert({
        hunter_id: payload.hunter_id,
        property_id: payload.property_id,
      });
      if (error) throw error;
    } else if (payload.action === 'REMOVE') {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('hunter_id', payload.hunter_id)
        .eq('property_id', payload.property_id);
      if (error) throw error;
    }
  }

  return { isOnline, isSyncing, deadLetteredCount, processSyncQueue };
}
```

### 5.3 Image Caching (New)

The original `vite-plugin-pwa` config only cached the `properties` REST endpoint — not listing images, which are the heaviest payload on exactly the low-bandwidth 3G connections this app is designed for. See Section 8 for the corrected `workbox.runtimeCaching` config with a `CacheFirst` strategy for Supabase Storage image URLs.

---

## 6. Safaricom M-PESA Integration (Supabase Edge Functions) — Hardened

**This section incorporates Improvement #1 (security hardening) directly — build the functions this way from the start, do not ship the naive version first.**

### 6.1 Security Requirements (must all be satisfied)

1. **Callback authenticity**: `mpesa-callback` must validate a shared secret before touching the database. Include a secret token as a path or query parameter on the `CallBackURL` registered with Daraja (e.g. `${SUPABASE_URL}/functions/v1/mpesa-callback?token=${MPESA_CALLBACK_SECRET}`), and reject any request whose token doesn't match `Deno.env.get("MPESA_CALLBACK_SECRET")`.
2. **Idempotency**: the callback's `UPDATE` on `payments` must include `AND status = 'pending'` so a retried Safaricom webhook is a no-op rather than double-confirming a booking.
3. **Caller authentication on `stk-push`**: verify the caller's Supabase JWT before initiating a charge. Do not accept an unauthenticated request.
4. **Server-side amount authority**: `stk-push` must not trust a client-supplied `amount`. Look up the expected amount server-side from the `booking_id` (e.g. a fixed viewing-deposit amount, or the property's listing-boost price) and use that value in the Daraja payload — never the value the client sent.

### 6.2 Function 1: `supabase/functions/stk-push/index.ts` (hardened)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "254" + cleaned.substring(1);
  else if (cleaned.startsWith("7") || cleaned.startsWith("1")) cleaned = "254" + cleaned;
  return cleaned;
}

async function getMpesaAccessToken(): Promise<string> {
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
  const environment = Deno.env.get("MPESA_ENVIRONMENT") || "sandbox";

  const url = environment === "production"
    ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
  });

  const data = await response.json();
  return data.access_token;
}

// NEW: server-side amount authority — never trust a client-supplied amount.
async function resolveAuthoritativeAmount(
  supabase: ReturnType<typeof createClient>,
  purpose: "viewing_deposit" | "listing_boost" | "subscription" | "rent",
  bookingId: string | null
): Promise<number> {
  if (purpose === "viewing_deposit") {
    // Fixed policy amount — adjust to your actual product decision.
    return 200; // KES, flat viewing deposit fee held in escrow
  }
  if (purpose === "listing_boost") {
    return 500; // KES, flat boost fee — replace with a real pricing table lookup as needed
  }
  throw new Error(`Unsupported or not-yet-priced payment purpose: ${purpose}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // NEW: authenticate the caller via their JWT before doing anything else.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phoneNumber, bookingId, purpose = "viewing_deposit", accountReference = "DIMORA" } = await req.json();
    // NOTE: 'amount' is intentionally NOT read from the request body anymore.

    const amount = await resolveAuthoritativeAmount(supabase, purpose, bookingId ?? null);

    const formattedPhone = formatPhoneNumber(phoneNumber);
    const shortCode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const environment = Deno.env.get("MPESA_ENVIRONMENT") || "sandbox";
    const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET")!; // NEW

    const now = new Date();
    now.setHours(now.getHours() + 3); // UTC+3 East Africa Time
    const timestamp = now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = btoa(`${shortCode}${passkey}${timestamp}`);

    const token = await getMpesaAccessToken();
    const stkPushUrl = environment === "production"
      ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
      : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      // NEW: secret token appended to the callback URL, validated in mpesa-callback.
      CallBackURL: `${supabaseUrl}/functions/v1/mpesa-callback?token=${callbackSecret}`,
      AccountReference: accountReference.substring(0, 12),
      TransactionDesc: `Dimora-${accountReference}`.substring(0, 12),
    };

    const stkResponse = await fetch(stkPushUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const resData = await stkResponse.json();

    if (resData.ResponseCode === "0") {
      await supabase.from("payments").insert({
        merchant_request_id: resData.MerchantRequestID,
        checkout_request_id: resData.CheckoutRequestID,
        booking_id: bookingId || null,
        purpose,
        escrow_status: purpose === "viewing_deposit" ? "held" : null, // NEW
        phone_number: formattedPhone,
        amount,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ success: true, checkoutRequestId: resData.CheckoutRequestID }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: resData.CustomerMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 6.3 Function 2: `supabase/functions/mpesa-callback/index.ts` (hardened)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // NEW: validate the shared-secret token before doing anything else.
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token !== Deno.env.get("MPESA_CALLBACK_SECRET")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) return new Response("Invalid Payload", { status: 400 });

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (ResultCode === 0) {
      const items: Array<{ Name: string; Value: any }> = CallbackMetadata.Item;
      const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

      // NEW: idempotent update — "AND status = 'pending'" makes a retried webhook a no-op.
      const { data: payment } = await supabase
        .from("payments")
        .update({
          status: "completed",
          mpesa_receipt_number: receipt,
          raw_callback: body,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", CheckoutRequestID)
        .eq("status", "pending")
        .select("booking_id, purpose")
        .single();

      if (payment?.booking_id) {
        if (payment.purpose === "viewing_deposit") {
          // Escrow stays 'held' at this point — release happens only when the hunter
          // confirms the viewing occurred (Section 9.2), not automatically on payment success.
          await supabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("id", payment.booking_id);
        } else {
          await supabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("id", payment.booking_id);
        }
      }
    } else {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          failure_reason: ResultDesc,
          raw_callback: body,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", CheckoutRequestID)
        .eq("status", "pending"); // NEW: idempotent here too
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }), { status: 500 });
  }
});
```

### 6.4 Function 3: `supabase/functions/release-escrow/index.ts` (NEW — supports Section 9.2)

Triggered when a hunter confirms a viewing occurred. Releases the held deposit to the agent. Requires the caller's JWT to match the `hunter_id` on the booking.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bookingId } = await req.json();
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, hunter_id, status")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking || booking.hunter_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Not authorized to confirm this viewing" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("bookings").update({ hunter_confirmed_viewing: true }).eq("id", bookingId);

    const { error: escrowError } = await supabase
      .from("payments")
      .update({ escrow_status: "released_to_agent" })
      .eq("booking_id", bookingId)
      .eq("purpose", "viewing_deposit")
      .eq("escrow_status", "held"); // idempotent — won't double-release

    if (escrowError) throw escrowError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 6.5 Escrow Settlement, Refunds & Disputes (NEW — closes the escrow loop)

The original spec defined `escrow_status` values it never operationalized. Clarifications and required flows:

- **Custody semantics**: STK Push collects the deposit into Dimora's own Paybill. `escrow_status = 'held'` is a **ledger state**, not segregated custody — funds sit in the business account until payout. The `payments` table is therefore the source of truth for what is owed to whom.
- **Release to agent (payout)**: `release-escrow` flips the ledger state; actual money movement to the agent's M-PESA happens via **Daraja B2C** or a manual settlement run. *Decision needed in Phase 2*: automated B2C per-release vs. a daily/weekly ops batch (recommended for MVP — cheaper, auditable, and B2C limits are configurable).
- **Refund path (`refund-escrow` edge function)**: mirrors `release-escrow` — hunter-authenticated, idempotent via `.eq("escrow_status", "held")`, flips state to `refunded_to_hunter`. Actual refund uses Daraja B2C reversal / manual M-PESA reversal within an SLA (e.g. 3 business days).
- **Auto-refund timeout**: if the viewing time passes with no hunter confirmation and no agent check-in, a scheduled job (Supabase `pg_cron` + edge function) flags the payment after 72h for auto-refund rather than letting deposits sit in limbo forever.
- **Dispute flow**: either party can dispute before release → set `escrow_status = 'disputed'`; admins resolve via the admin queue (Section 4 RLS already restricts verification/admin surfaces). Disputed payments are excluded from both release and refund until resolved.

---

## 7. Recommended Project File Structure (Revised)

```
dimora-pwa/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── public/
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   └── maskable-icon.png
├── src/
│   ├── components/
│   │   ├── agent/
│   │   │   ├── LeadKanban.tsx
│   │   │   ├── ListingForm.tsx
│   │   │   ├── ListingAnalyticsPanel.tsx        # NEW (Section 9.3)
│   │   │   └── VerificationToggle.tsx
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx
│   │   │   ├── HeaderBar.tsx
│   │   │   └── OfflineBanner.tsx
│   │   ├── property/
│   │   │   ├── PropertyCard.tsx
│   │   │   ├── PropertyGrid.tsx
│   │   │   ├── VerifiedBadge.tsx                 # signature element, Section 3.4
│   │   │   ├── NeighborhoodSignalCard.tsx        # NEW (Section 9.2)
│   │   │   ├── PriceComparison.tsx               # NEW (Section 9.2)
│   │   │   └── WhatsAppButton.tsx
│   │   ├── icons/                                # NEW — custom icon set, Section 3.3
│   │   │   ├── TrustBadgeIcons.tsx
│   │   │   └── PropertyTypeIcons.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx
│   │       └── InstallBanner.tsx                 # NEW (Section 8.3)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useOfflineQueue.ts
│   │   ├── useOfflineSync.ts
│   │   ├── useProperties.ts
│   │   ├── useStkPush.ts
│   │   ├── useEscrowRelease.ts                   # NEW (Section 9.2)
│   │   └── useInstallPrompt.ts                   # NEW (Section 8.3)
│   ├── lib/
│   │   ├── indexedDB.ts
│   │   ├── mpesa.ts
│   │   ├── whatsapp.ts                           # NEW (Section 9.3)
│   │   ├── sms.ts                                # NEW (Section 9.6)
│   │   └── supabaseClient.ts
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Home.tsx
│   │   ├── PropertyDetail.tsx
│   │   ├── Search.tsx
│   │   ├── RentLedger.tsx                        # NEW (Section 9.4)
│   │   ├── AdminVerificationQueue.tsx            # NEW — admin surface for verifications + KYC (Section 6.5 / 4)
│   │   └── UserProfile.tsx
│   ├── styles/
│   │   └── globals.css
│   ├── App.tsx
│   ├── main.tsx
│   └── service-worker.ts
├── supabase/
│   ├── functions/
│   │   ├── mpesa-callback/
│   │   │   └── index.ts
│   │   ├── stk-push/
│   │   │   └── index.ts
│   │   ├── release-escrow/                       # NEW
│   │   │   └── index.ts
│   │   ├── refund-escrow/                        # NEW (Section 6.5)
│   │   │   └── index.ts
│   │   └── whatsapp-webhook/                     # NEW (Section 9.3)
│   │       └── index.ts
│   └── migrations/
│       └── 20260101000000_init_dimora.sql
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 8. Deployment, PWA Configuration & Environment Variables (Revised)

### 8.1 Vite PWA Setup (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dimora Real Estate Kenya',
        short_name: 'Dimora',
        description: 'Verified properties and agent workspace for Kenya.',
        theme_color: '#EDE6D6', // updated to match revised palette (Section 3.1)
        background_color: '#EDE6D6',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/properties.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-properties-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 }
            }
          },
          {
            // NEW: listing images — the heaviest payload on the 3G connections
            // this app is explicitly designed for. Missing from the original spec.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-listing-images-cache',
              expiration: { maxEntries: 300, maxAgeSeconds: 604800 }, // 7 days
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
});
```

### 8.3 Install Prompt Strategy (New — dual prompt: native + custom)

The manifest and service worker setup above already make Dimora installable through the browser's own default affordance (e.g. the install icon Chrome/Edge show in the address bar) with zero extra code. On top of that, run a **second, custom install prompt** so installation can be offered at a deliberate, high-intent moment in the product rather than relying only on the browser's passive icon. The two are not mutually exclusive — both can be live at the same time, since they trigger the same underlying OS-level install flow.

**How the two coexist:**
1. **Native affordance**: requires no extra code. Chrome/Edge automatically show an install icon once the manifest + service worker installability criteria are met.
2. **Custom in-app prompt**: capture the browser's `beforeinstallprompt` event yourself, call `event.preventDefault()` so no default mini-infobar appears, stash the event, and fire `event.prompt()` later from your own UI (e.g. an `InstallBanner` triggered after a hunter's first completed booking, or after favoriting 2+ properties — a moment of clear engagement, not the first cold visit).

**iOS Safari has neither by default**: `beforeinstallprompt` does not fire on iOS Safari at all, so there is no native icon and the custom prompt above has nothing to hook into. Detect this case (via user-agent sniffing or checking `navigator.standalone`) and show a manual instructional variant of `InstallBanner` instead — e.g. "Tap Share, then Add to Home Screen" — rather than silently offering nothing.

`src/hooks/useInstallPrompt.ts`:

```typescript
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS Safari, which never fires beforeinstallprompt.
    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    setIsStandalone((window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches);

    const handler = (event: Event) => {
      event.preventDefault(); // suppress the default mini-infobar
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
    setDeferredPrompt(null);
  }

  return {
    isInstallable,           // true once beforeinstallprompt has fired (Android/Chrome/Edge)
    isIos,                   // true on iOS Safari — show the manual instructional variant instead
    isStandalone,            // true if already installed/running standalone — don't show any banner
    promptInstall,
  };
}
```

`src/components/ui/InstallBanner.tsx` should render three states based on this hook: (1) nothing, if `isStandalone`; (2) an "Install Dimora" button calling `promptInstall()`, if `isInstallable`; (3) a manual "Tap Share → Add to Home Screen" instructional banner, if `isIos`. Trigger this component's visibility from a deliberate product moment (e.g. post-booking-confirmation), not on initial page load.

### 8.4 Environment Variables Matrix (Revised)

#### Client-side (`.env.local`)
```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

#### Supabase Edge Function Secrets
Set using CLI: `supabase secrets set --env-file .env.secrets`

```bash
MPESA_CONSUMER_KEY="your_daraja_consumer_key"
MPESA_CONSUMER_SECRET="your_daraja_consumer_secret"
MPESA_PASSKEY="your_daraja_passkey"
MPESA_SHORTCODE="174379"
MPESA_ENVIRONMENT="sandbox" # Set to 'production' for live deployment
MPESA_CALLBACK_SECRET="generate-a-long-random-token-here" # NEW — required for callback auth, Section 6.1

# NEW — for Section 9.3 and 9.6
WHATSAPP_BUSINESS_API_TOKEN="your_whatsapp_business_token"
WHATSAPP_PHONE_NUMBER_ID="your_whatsapp_phone_number_id"
SMS_GATEWAY_API_KEY="your_sms_gateway_key" # e.g. Africa's Talking
SMS_GATEWAY_USERNAME="your_sms_gateway_username"
```

---

## 9. Differentiating Feature Set (New — build after core loop works end to end)

### 9.1 Trust Engine Upgrades
- **Registry cross-check**: where feasible, cross-check title/parcel numbers against Kenya's Ardhisasa land registry as a `registry_crosscheck` verification kind — this is a defensible trust signal competitors can't easily replicate, since it's backed by a government source rather than self-attestation.
- **Geo-locked, timestamped site-visit proof**: verifying agents' photo/video evidence must carry GPS coordinates and a timestamp matching the property's location (`evidence_latitude`/`evidence_longitude`/`evidence_captured_at` on `property_verifications`), so verification can't be rubber-stamped from an office.
- **Tamper-evident evidence hashing**: store `evidence_hash` (a hash of the evidence file) alongside each verification record so tampering after the fact is detectable.
- **Review gating**: reviews (`reviews` table) can only be created for `completed` bookings belonging to the reviewing hunter — enforced at the RLS layer (Section 4), not just in application code.

### 9.2 Hunter-Side Features
- **Viewing-deposit escrow**: implemented via `payments.purpose = 'viewing_deposit'` + `escrow_status`, released only via the `release-escrow` edge function (Section 6.4) once the hunter confirms the viewing happened. This directly targets the market's most common scam — fake agents collecting a viewing fee and disappearing.
- **Commute-aware search**: search/filter properties by commute time (e.g. "under 40 minutes from Westlands by matatu"), not just raw distance — powered by the new `location GEOGRAPHY` column and a routing/commute-time API integration. *Decision needed*: provider (Mapbox vs OpenRouteService vs Google Routes) chosen on cost-per-query; cache a neighborhood-pair commute matrix aggressively to bound API spend.
- **Search mechanics (baseline, new)**: keyword search uses Postgres trigram (`pg_trgm`) similarity + full-text over `title`/`neighborhood`/`county`, combined with structured enum/range filters (type, price, bedrooms). No external search service (Meilisearch/Algolia) until listings exceed ~100k — Supabase Postgres is sufficient at MVP scale.
- **Price transparency**: `PriceComparison.tsx` component shows "similar listings in this neighborhood average KES X" on every listing detail page, computed from `properties` grouped by `county`/`sub_county`/`neighborhood`/`type`.
- **Neighborhood signal cards**: crowdsourced ratings on water reliability, security, and transport access per neighborhood (`neighborhood_signals` table), surfaced on property detail pages.

### 9.3 Agent-Side Features
- **WhatsApp-native lead capture**: incoming WhatsApp Business API messages automatically create or update an `agent_workspace_items` row (`lead_source = 'whatsapp'`, `whatsapp_thread_id` populated), so the CRM organizes what agents are already doing on WhatsApp rather than asking them to switch tools. Requires a new `whatsapp-webhook` edge function that verifies Meta's `X-Hub-Signature-256` before processing, routes inbound messages to the owning agent by phone-number match, and idempotently upserts the CRM row per thread.
- **Listing performance analytics**: `listing_events` table logs `view` / `save` / `whatsapp_click` events per property; `ListingAnalyticsPanel.tsx` surfaces this to agents and feeds a natural "boost this listing" upsell (`payments.purpose = 'listing_boost'`).
- **AI-assisted listing writeup**: given agent-uploaded photos and rough notes/voice input, generate a clean listing description — raises the floor on listing quality platform-wide with minimal agent effort.

### 9.4 Financial Innovation
- **Rent ledger**: `rent_ledger` table tracks ongoing rent payment history per tenant/property (distinct from the one-off viewing-deposit payment flow), turning Dimora from a discovery tool into something landlords/agents depend on monthly. Deliberately scoped to tenant↔property/agent, **not** a landlord entity — see Section 10.

### 9.5 Fraud Prevention
- **Duplicate-image / stock-photo detection**: lightweight perceptual-hash or AI-based check on newly uploaded listing images, flagging photos reused across multiple "different" agents or lifted from stock sources — catches a meaningful share of scam listings automatically without added agent friction.

### 9.6 Low-Bandwidth / Offline Resilience
- **SMS fallback**: booking confirmations and payment status also fire as SMS (via `src/lib/sms.ts` + an SMS gateway like Africa's Talking), not only in-app push, so critical events reach the user even after their mobile data runs out.

---

## 10. Explicitly Out of Scope for Now — Landlord Module (Future Consideration)

A landlord module (multi-unit management, rent rolls, maintenance tickets, lease renewals, direct landlord-to-tenant listings without an agent) is a **plausible future direction, not a current build target**. Reasoning:

- It represents a third stakeholder with a fundamentally different job-to-be-done (property management vs. discovery/trust), and is its own competitive category — building it now risks diluting the MVP before the core hunter↔agent loop is proven.
- It raises data-model questions the current schema doesn't answer (can a landlord list without an agent? who gets verification credit? does an agent manage on a landlord's behalf?) — these are decisions that ripple through the whole schema, not a simple additive table.

**What to do now instead**: don't foreclose it.
- The `rent_ledger` table (Section 4) is deliberately scoped to `tenant_id` + `property_id`, not a landlord entity, so it can be extended later without a schema rewrite.
- `user_role` intentionally does **not** include `'landlord'` yet — leave room to add it as a future enum value plus corresponding RLS policies once there's a validated reason to build the module.
- Treat a full landlord module as a **post-PMF v2 initiative** — do not schedule it alongside Sections 6, 3, and 9 above.

---

## 11. Compliance & Data Protection — Kenya DPA, 2018 (NEW)

The platform processes Kenyan personal data (names, phone numbers, ID documents, location history) at every step of its core loop. These are non-negotiable requirements, not nice-to-haves:

- **Registration**: register as a data controller with the Office of the Data Protection Commissioner (ODPC) before processing personal data at scale.
- **Consent capture**: explicit, logged consent for marketing/WhatsApp outreach at signup and again before the first outbound campaign message. Transactional messages (booking/payment confirmations, escrow notices) are documented as a distinct lawful basis and never double as marketing.
- **Data minimization & retention**: `payments.raw_callback` is purged or anonymized after 12 months; KYC documents are retained only while an agent is active plus a defined tail period; listing analytics events are aggregated after 24 months.
- **Right to erasure**: account deletion flow that removes/anonymizes PII (profiles, contact info, KYC docs) while preserving fraud/dispute audit trails in aggregate or hashed form — soft-delete patterns already in this schema support this.
- **PII handling discipline**: TLS in transit (Supabase default) + RLS at rest; edge functions must never log phone numbers, KYC document URLs, or raw callbacks; KYC evidence lives in a private bucket with admin-only access (Section 4).
- **Role administration**: role elevation ('agent'/'admin') happens exclusively through service-role admin flows — both signup and client-side profile updates are locked down for this reason (Section 4).
