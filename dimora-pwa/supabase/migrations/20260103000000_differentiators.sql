-- ==========================================
-- PROJECT DIMORA: PHASE 5 DIFFERENTIATOR DDL
-- ==========================================
-- (a) WhatsApp agent routing: one inbound phone can fan out to the agent who
--     set up the route, without leaking thread visibility to other agents.
-- (b) WhatsApp-originated CRM leads dedupe on (agent, thread).
-- (c) pg_trgm aware duplicate-listing detection for the listing writeup flow.
-- (d) Listing boost priceable feature surfaced to search + analytics.

-- 1. WHATSAPP AGENT ROUTES ------------------------------------------------
CREATE TABLE public.whatsapp_agent_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT NOT NULL UNIQUE,
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_whatsapp_routes_agent ON public.whatsapp_agent_routes(agent_id);

ALTER TABLE public.whatsapp_agent_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage their own WhatsApp routes"
    ON public.whatsapp_agent_routes FOR ALL
    USING (auth.uid() = agent_id AND public.get_auth_role() = 'agent');

-- 2. WHATSAPP CRM LEAD DEDUPE ---------------------------------------------
-- A WhatsApp thread must produce at most one workspace lead per agent.
CREATE UNIQUE INDEX uq_workspace_thread_per_agent
    ON public.agent_workspace_items (agent_id, whatsapp_thread_id)
    WHERE whatsapp_thread_id IS NOT NULL;

-- 3. DUPLICATE LISTING DETECTION ------------------------------------------
-- Invoker-privileged on purpose: callers only ever see listings their own RLS
-- policy already exposes (published, or their own drafts).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.detect_duplicate_listings(
    p_title TEXT,
    p_neighborhood TEXT,
    p_county TEXT,
    p_min_similarity DOUBLE PRECISION DEFAULT 0.6
)
RETURNS TABLE (
    duplicate_id UUID,
    title TEXT,
    neighborhood TEXT,
    county TEXT,
    price NUMERIC,
    similarity_score DOUBLE PRECISION
)
LANGUAGE sql STABLE SET search_path = public
AS $$
    SELECT p.id, p.title, p.neighborhood, p.county, p.price,
           GREATEST(
               similarity(p.title, p_title),
               similarity(p.neighborhood, p_neighborhood)
           ) AS similarity_score
    FROM public.properties p
    WHERE p.deleted_at IS NULL
      AND p.title % p_title
      AND (p.neighborhood % p_neighborhood OR p.county = p_county)
      AND GREATEST(
            similarity(p.title, p_title),
            similarity(p.neighborhood, p_neighborhood)
          ) >= p_min_similarity
    ORDER BY similarity_score DESC
    LIMIT 5;
$$;

-- 4. LISTING BOOST ---------------------------------------------------------
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_properties_boosted
    ON public.properties (is_boosted, boost_expires_at)
    WHERE is_boosted = true AND boost_expires_at IS NOT NULL;

-- Auto-expire boosts (mirrors the auto-refund cron pattern from migration 2).
SELECT cron.schedule(
    'dimora-expire-boosts',
    '0 * * * *',
    $$
    UPDATE public.properties
    SET is_boosted = false, updated_at = timezone('utc'::text, now())
    WHERE is_boosted = true
      AND boost_expires_at IS NOT NULL
      AND boost_expires_at < timezone('utc'::text, now())
    $$
);