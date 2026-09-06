-- ==========================================
-- PROJECT DIMORA: WHATSAPP AGENT MODULE - DATABASE MIGRATION
-- Canonical source: Whatsapp Agent.md Section 4
-- ==========================================

-- 1. NEW TABLES FOR WHATSAPP AGENT MODULE

-- WHATSAPP_INSTANCES: One row per Evolution API instance
CREATE TABLE public.whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    evolution_instance_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'error'
    webhook_secret TEXT NOT NULL,
    evolution_api_key TEXT NOT NULL,
    evolution_base_url TEXT NOT NULL DEFAULT 'https://api.evolution.com',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_whatsapp_instances_tenant ON public.whatsapp_instances(tenant_id);
CREATE INDEX idx_whatsapp_instances_phone ON public.whatsapp_instances(phone_number);

-- CONVERSATION_SESSIONS: Live agent state per contact
CREATE TABLE public.conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    state JSONB NOT NULL DEFAULT '{}',
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    handoff_to_human BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX idx_conversation_sessions_unique ON public.conversation_sessions(tenant_id, contact_phone);
CREATE INDEX idx_conversation_sessions_thread ON public.conversation_sessions(thread_id);

-- MESSAGES_LOG: Full message history, idempotency source of truth
CREATE TABLE public.messages_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    evolution_message_id TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'inbound' | 'outbound'
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX idx_messages_log_evolution_message_id ON public.messages_log(evolution_message_id);
CREATE INDEX idx_messages_log_thread ON public.messages_log(thread_id);
CREATE INDEX idx_messages_log_tenant ON public.messages_log(tenant_id);

-- LEADS / CRM_ITEMS: Where inbound WhatsApp becomes a workable lead
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lead_source TEXT NOT NULL DEFAULT 'whatsapp',
    thread_id TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
    assigned_to UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX idx_leads_thread ON public.leads(thread_id);
CREATE INDEX idx_leads_contact ON public.leads(contact_phone);

-- CONSENT_LOG: Marketing/outreach consent trail
CREATE TABLE public.consent_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    consent_type TEXT NOT NULL, -- 'marketing' | 'sms' | 'email'
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_consent_log_tenant ON public.consent_log(tenant_id);
CREATE INDEX idx_consent_log_contact ON public.consent_log(contact_phone);

-- 2. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

-- WHATSAPP_INSTANCES: Only admins can manage Evolution API instances
CREATE POLICY "Admins manage whatsapp instances"
    ON public.whatsapp_instances FOR ALL
    USING (public.get_auth_role() = 'admin');

-- CONVERSATION_SESSIONS: Tenants can access their own sessions
CREATE POLICY "Tenants access own conversation sessions"
    ON public.conversation_sessions FOR ALL
    USING (auth.uid() = tenant_id);

-- MESSAGES_LOG: Tenants can access their own message history
CREATE POLICY "Tenants access own message history"
    ON public.messages_log FOR SELECT
    USING (auth.uid() = tenant_id);

-- LEADS: Agents can access leads assigned to them, tenants can see their own
CREATE POLICY "Agents access assigned leads"
    ON public.leads FOR SELECT
    USING (
        auth.uid() = assigned_to
        OR auth.uid() = tenant_id
        OR public.get_auth_role() = 'admin'
    );

CREATE POLICY "Tenants create their own leads"
    ON public.leads FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

-- CONSENT_LOG: Tenants can manage their own consent records
CREATE POLICY "Tenants manage consent records"
    ON public.consent_log FOR ALL
    USING (auth.uid() = tenant_id);

-- 3. AUTOMATED TRIGGERS & FUNCTIONS

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_whatsapp_instances_modtime BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_conversation_sessions_modtime BEFORE UPDATE ON public.conversation_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_leads_modtime BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. INSTANCE → TENANT RESOLVER FUNCTION

CREATE OR REPLACE FUNCTION public.resolve_whatsapp_instance_to_tenant(
    instance_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    tenant_id UUID;
BEGIN
    SELECT tenant_id INTO tenant_id
    FROM public.whatsapp_instances
    WHERE evolution_instance_name = instance_id
    AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unrecognized WhatsApp instance: %', instance_id
            USING ERRCODE = 'P0001';
    END IF;
    
    RETURN tenant_id;
END;
$$;

-- 5. IDEMPOTENCY FUNCTION FOR WEBHOOKS

CREATE OR REPLACE FUNCTION public.handle_webhook_idempotency(
    p_evolution_message_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    exists_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO exists_count
    FROM public.messages_log
    WHERE evolution_message_id = p_evolution_message_id;
    
    IF exists_count > 0 THEN
        RETURN false; -- Duplicate webhook, should be rejected
    END IF;
    
    RETURN true; -- New webhook, can be processed
END;
$$;
