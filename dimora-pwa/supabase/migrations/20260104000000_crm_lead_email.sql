-- Lead capture (CRM): persist a lead's email alongside name/phone.
ALTER TABLE public.agent_workspace_items
    ADD COLUMN IF NOT EXISTS lead_email TEXT;