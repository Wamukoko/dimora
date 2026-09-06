# Build Prompt: Direct Evolution API WhatsApp Agent Module
### (Replacing the hosted n8n + Evolution API integration — multi-tenant AI agency SaaS)

> **How to use this file**: Paste this whole document as the initial instruction
> to your vibe-coding agent (Claude Code, Cursor, Windsurf, etc.). It is written
> so the agent can work top-to-bottom without needing to ask you what "done"
> looks like at each step. Where a decision genuinely needs your input, it's
> flagged as `DECISION NEEDED` rather than silently assumed.

---

## 0. Context you must internalize before writing any code

This platform is a **multi-tenant AI agency SaaS**: the agency onboards client
businesses ("tenants" — e.g. a real estate agency, a clinic, a retail brand),
and each tenant gets its own WhatsApp number, its own knowledge base/catalog,
and its own AI conversational agent that talks to *their* customers. Today,
that conversational layer is wired as:

```
WhatsApp <-> Evolution API <-> n8n (workflow: webhook -> AI node -> send)
```

n8n is being **removed as the runtime brain**. Evolution API stays (it's just
the WhatsApp bridge — Baileys/Business API underneath). The web app's own
backend becomes the thing that receives Evolution API's webhooks, runs the
agent logic, and calls Evolution API's REST endpoints to reply. This is a
lift-and-shift of *logic*, not a re-architecture of the WhatsApp layer.

**Reference patterns to borrow** (these come from a sibling project spec in
this workspace — a multi-tenant, offline-first, RLS-first SaaS — and are good
defaults here too, adjust naming as needed):
- Row-Level Security scoping every table by `tenant_id`, enforced at the DB
  layer, not just in application code.
- Idempotent webhook handling keyed on the provider's own message ID, so
  retries/duplicates never double-process a message.
- Inbound messages upsert into a CRM/lead table (`lead_source = 'whatsapp'`,
  a `thread_id` column linking back to the conversation) rather than living
  only in chat logs.
- Explicit, logged consent before any marketing-style outbound message;
  transactional replies (a direct answer to a direct question) don't require
  the same consent gate but should still be logged.
- A private, admin-only path for anything sensitive (API keys, raw webhook
  payloads) — never logged in plaintext, never exposed to a client-facing role.

---

## 1. Scope

**In scope for this module:**
- Evolution API service wrapper (instance lifecycle + send + receive)
- Webhook receiver with signature/API-key verification and idempotency
- Per-tenant, per-contact conversation/session state
- LLM orchestration layer that loads the correct tenant's agent config and
  calls the model with tools
- Tool-calling functions the agent can invoke (see Section 8)
- Multi-tenant routing (which inbound instance maps to which tenant)
- Consent and opt-out handling
- Cutover plan from n8n to the new endpoint, with rollback

**Explicitly out of scope for this pass** (flag as future work, don't build):
- A UI for provisioning new WhatsApp instances (assume an existing
  admin flow or manual Evolution API instance creation for now)
- Billing/usage metering per tenant
- Non-WhatsApp channels (SMS, Instagram, etc.)
- Voice note transcription (note the hook point, don't implement)
- MPESA payment processing (bypassed for trial phase)
- Escrow management (bypassed for trial phase)

---

## 2. Pre-work audit (do this before writing new code)

1. Enumerate every existing Evolution API instance and its currently
   configured webhook URL (should currently point at n8n).
2. For each instance, pull the corresponding n8n workflow and write a
   one-paragraph summary of what it actually does today (intents handled,
   any external calls it makes — CRM writes, calendar bookings, etc.). This
   becomes your parity checklist for Section 9.
3. **`DECISION NEEDED`**: confirm with the project owner whether instances
   are cut over one-by-one (safer, staggered) or all at once. Default to
   one-by-one if not specified — lower blast radius.
4. Do not delete or disable any n8n workflow until its replacement has
   passed the parity checklist in Section 9.

---

## 3. Target architecture

```
                         Multi-Tenant Web App Backend
                    +--------------------------------------+
   WhatsApp  <----> |  Evolution API   |  Webhook Receiver  |
   (per tenant)     |  (bridge only)   |  /webhooks/evo/:id |
                    +--------------------------------------+
                                  |
                                  v
                    +--------------------------------------+
                    |   Instance -> Tenant Resolver         |
                    +--------------------------------------+
                                  |
                                  v
                    +--------------------------------------+
                    |   Conversation Session Store          |
                    |   (state per tenant + contact_phone)  |
                    +--------------------------------------+
                                  |
                                  v
                    +--------------------------------------+
                    |   Agent Orchestrator (LLM call)       |
                    |   loads tenant config + system prompt |
                    |   from Section 8, exposes tools       |
                    +--------------------------------------+
                          |                    |
                          v                    v
                +------------------+  +------------------------+
                | Tool execution   |  | Evolution API send      |
                | (CRM upsert,     |  | (sendText/sendMedia)    |
                | escalate, book,  |  +------------------------+
                | catalog lookup)  |
                +------------------+
```

---

## 4. Data model additions

Add (or reuse equivalents of) these tables, all scoped by `tenant_id` with
RLS enabled:

| Table | Purpose | Key columns |
|---|---|---|
| `whatsapp_instances` | One row per Evolution API instance | `tenant_id`, `evolution_instance_name`, `phone_number`, `status`, `webhook_secret` |
| `conversation_sessions` | Live agent state per contact | `tenant_id`, `contact_phone`, `thread_id`, `state jsonb`, `last_message_at`, `handoff_to_human boolean` |
| `messages_log` | Full message history, idempotency source of truth | `tenant_id`, `thread_id`, `evolution_message_id` (unique), `direction`, `payload`, `created_at` |
| `leads` / `crm_items` | Where inbound WhatsApp becomes a workable lead | `tenant_id`, `lead_source = 'whatsapp'`, `thread_id`, `contact_phone`, `status`, `assigned_to` |
| `consent_log` | Marketing/outreach consent trail | `tenant_id`, `contact_phone`, `consent_type`, `granted_at`, `revoked_at` |

`evolution_message_id` must be `UNIQUE` — this is what makes webhook retries
safe. Reject/no-op on a duplicate rather than reprocessing.

---

## 5. Step-by-step build sequence

Work in this order. Each phase has an exit criterion — don't move on until
it's met.

### Phase 1 — Evolution API service wrapper
Build a thin internal client (not a new dependency, just typed functions)
covering: `createInstance`, `getConnectionState`, `sendText`, `sendMedia`,
`setWebhook`. Centralize the base URL and API key here so nothing else in
the codebase calls Evolution API's REST endpoints directly.
**Exit criterion**: can send a text message to a real WhatsApp number by
calling one function, no n8n involved.

### Phase 2 — Webhook receiver
New endpoint (e.g. `POST /webhooks/evolution/:instanceId`). Verify the
request is genuinely from Evolution API (API-key header or HMAC, whichever
Evolution API exposes for your version). Look up `evolution_message_id` in
`messages_log`; if it exists, return 200 immediately and do nothing else.
**Exit criterion**: sending the same webhook payload twice results in
exactly one processed message and one CRM/lead upsert.

### Phase 3 — Instance → tenant resolver
Map `instanceId` (or instance name) from the webhook path to a `tenant_id`
via `whatsapp_instances`. Fail closed — an unrecognized instance ID should
be logged and dropped, never processed against a default/wrong tenant.
**Exit criterion**: two different tenants' instances never cross-contaminate
each other's sessions, even under concurrent load.

### Phase 4 — Session/state manager
Load or create the `conversation_sessions` row for
`(tenant_id, contact_phone)`. This holds short-term state the agent needs
across turns (last topic, any half-completed booking, etc.) — keep it small
and structured (JSON), not a dump of chat history (that lives in
`messages_log`).
**Exit criterion**: a multi-turn conversation (e.g. "show me 2-bedrooms" →
"the one on Ngong Road" → "book a viewing") resolves correctly across
separate webhook calls.

### Phase 5 — Agent orchestrator
This is where the system prompt in **Section 8** gets loaded, templated
with the tenant's own config (business name, tone, catalog/knowledge
source, escalation rules), and called with the tools from **Section 6**.
Pass in: the incoming message, the session state, and a bounded window of
recent `messages_log` entries for context.
**Exit criterion**: the agent's reply is generated from the tenant's own
config, not hardcoded — swapping the tenant config swaps the agent's
persona and knowledge without touching code.

### Phase 6 — Tool execution layer
Implement the tools listed in Section 6 as real functions the orchestrator
can call (function-calling / tool-use, not string-matching intents).
**Exit criterion**: each tool has a unit test that exercises it in
isolation from the LLM call.

### Phase 7 — Consent & compliance guardrails
Detect and honor opt-out keywords (e.g. "STOP", "UNSUBSCRIBE") by writing
to `consent_log` and setting a flag that suppresses future non-transactional
outbound messages to that contact. Transactional replies (a direct answer
to something the contact just asked) are never blocked by this.
**Exit criterion**: an opt-out keyword reliably halts marketing-style
outbound within one message, and the agent doesn't attempt to re-engage.

### Phase 7b — MPESA bypass (trial phase)
During trial phase, MPESA payment integration is **bypassed**:
- `schedule_booking` creates bookings without payment processing
- No escrow held for viewing deposits
- Bookings marked as "trial_bypassed = true" for audit purposes
**Exit criterion**: All bookings can be created without MPESA dependency

### Phase 8 — Cutover
For each instance from the Section 2 audit: point its Evolution API webhook
at the new endpoint, run it in shadow/parallel with n8n for a short window
if feasible (log-only, don't double-send), then fully cut over. Decommission
the n8n workflow only after the Section 9 parity check passes.
**Exit criterion**: n8n receives zero traffic for that instance and the new
endpoint has handled real conversations end-to-end with no regressions.

### Phase 8b — MPESA bypass verification (trial phase)
**Trial Phase Cutover**: MPESA integration is **bypassed** during trial:
- Bookings created without payment processing
- No escrow held for viewing deposits
- All booking flows continue normally for testing
- MPESA integration planned for Phase 9 (post-trial)

---

## 6. Tools available to the agent (implement as callable functions)

| Tool | What it does | Notes |
|---|---|---|
| `lookup_catalog(query)` | Search the tenant's product/listing/service catalog | Read-only, tenant-scoped |
| `check_availability(item_id, date?)` | Check slot/viewing/appointment availability | Read-only |
| `create_or_update_lead(fields)` | Upsert into `leads`/CRM with `lead_source = 'whatsapp'` | Idempotent on `thread_id` |
| `schedule_booking(item_id, datetime, contact)` | Create a booking/viewing/appointment | Should validate availability first. MPESA payment integration bypassed for trial phase. |
| `escalate_to_human(reason)` | Sets `handoff_to_human = true`, notifies assigned staff | Always available — see Constraints |
| `log_consent(type, granted)` | Writes to `consent_log` | Called on opt-in/opt-out language |
| `send_catalog_media(item_id)` | Sends an image/PDF via `sendMedia` | Rate-limit to avoid spamming media |

Keep this list tenant-agnostic — a real-estate tenant and a clinic tenant
both use the same tool *shapes*, backed by different data.

**Trial Phase Notes:**
- MPESA payment integration is **bypassed** — `schedule_booking` will create bookings without payment processing
- Escrow management is **bypassed** — viewing deposits are not held in escrow during trial
- All other tools function normally for lead capture and conversation management

---

## 7. Non-functional constraints

- **No message loss on retry**: idempotency (Section 4/Phase 2) is
  non-negotiable, not a nice-to-have.
- **Latency budget**: reply within a few seconds of the webhook firing;
  if a tool call or LLM call is slow, send a short "let me check on that"
  acknowledgment rather than leaving the contact hanging.
- **Graceful degradation**: if Evolution API or the LLM provider errors,
  retry with backoff, then fail to a human-handoff message rather than
  silently dropping the conversation.
- **Secrets**: each tenant's Evolution API instance key lives in the
  backend's secret store, never in client code, never logged in plaintext
  webhook payload dumps.
- **Tenant isolation**: enforced at the database layer (RLS or equivalent
  query scoping), not only in application logic — a bug in the orchestrator
  should not be able to leak one tenant's conversation into another's.

### Evolution API Key Management (DECISION NEEDED)

**Current State**: Evolution API keys are stored in the backend's secret store

**Trial Phase Recommendation**: Manual Evolution API key input via admin panel

**Admin Panel Integration Needed**:
- Add Evolution API key input field to Dimora admin panel
- Store keys in `whatsapp_instances.webhook_secret` field
- Provide validation and testing endpoint for key verification
- Include key rotation and audit logging capabilities

**Implementation Priority**: This is a **Phase 1 decision needed** — should keys be managed via admin panel or continue using secret store?

---

## 8. The WhatsApp Agent — system prompt template

This is the prompt loaded and templated per tenant in Phase 5. Variables in
`{{double_braces}}` are filled from that tenant's configuration record.

```markdown
# Role
You are {{agent_name}}, the WhatsApp conversational assistant for
{{business_name}}, a {{business_type}} operating in {{market_region}}.
You represent {{business_name}} directly to its customers — you are not a
generic assistant, and you never claim to be a human unless the business
has explicitly configured you to.

# Task
Your job is to help the person messaging you accomplish one of these, in
order of priority:
1. Answer questions about {{business_name}}'s {{catalog_noun}} (e.g.
   listings, products, services, availability) using only the data you're
   given — never invent details you don't have.
2. Move a genuinely interested person toward a concrete next step:
   booking, scheduling, or a qualified handoff to a human team member.
3. Capture enough information (name, need, timeline) to create or update a
   useful lead record, even if the conversation doesn't convert immediately.
You are not trying to close every conversation yourself — recognizing when
to hand off to a human is part of doing the job well.

# Input
On each turn you receive:
- The contact's latest WhatsApp message (text; media may arrive as a
  caption + type marker for now — full media understanding is a future
  capability).
- The current session state (JSON): anything already established in this
  conversation — a property/item of interest, a proposed date/time, whether
  a handoff has already been requested.
- A bounded window of recent conversation history for this thread.
- The tenant's own catalog/knowledge source (search results from
  `lookup_catalog`, not a static dump) — treat this as your only source of
  truth about what {{business_name}} actually offers.
- The tenant's configured tone/persona (`{{tone_description}}`) and any
  business-specific rules (`{{business_rules}}`, e.g. operating hours,
  pricing disclosure policy, languages spoken).

# Tools
You may call:
- `lookup_catalog(query)` — before answering any factual question about
  what's available, price, or specifics. Never answer from assumption.
- `check_availability(item_id, date?)` — before confirming any booking.
- `create_or_update_lead(fields)` — as soon as you know the contact's
  name and what they're interested in, even before a booking is confirmed.
- `schedule_booking(item_id, datetime, contact)` — only after availability
  is confirmed and the contact has explicitly agreed to the slot.
- `escalate_to_human(reason)` — whenever: the contact asks for a human
  explicitly; the request falls outside {{business_name}}'s catalog or your
  configured scope; the contact expresses frustration, a complaint, or a
  safety/legal concern; or you've attempted the same clarification twice
  without resolution.
- `log_consent(type, granted)` — whenever the contact opts in or out of
  future outreach, including any "STOP"/"UNSUBSCRIBE"-style message.
- `send_catalog_media(item_id)` — when a photo or document would answer
  the question better than text, and the contact hasn't already received it
  in this thread.

# Constraints
- Never fabricate availability, pricing, or catalog details — if
  `lookup_catalog` returns nothing relevant, say so and offer to check with
  a human, don't guess.
- Never impersonate a human team member or claim capabilities you don't
  have (e.g. "I've already told the agent" when no handoff has occurred).
- Treat any opt-out language as final for marketing-style messages — log it
  via `log_consent` and stop initiating non-transactional outreach to that
  contact, even if a human later asks you to re-engage them without a fresh
  opt-in.
- Do not collect more personal information than the task requires. Name and
  stated interest are enough for a lead; don't ask for ID numbers, exact
  addresses, or payment details over chat — those belong in a verified,
  human-supervised or in-app flow.
- Keep replies short and mobile-friendly — this channel is often used on
  low-end devices and patchy connections; avoid long paragraphs or large
  unrequested media.
- Respond in the language the contact is using; default to
  {{default_language}} only if their message is ambiguous.
- If a conversation has been flagged `handoff_to_human`, stop generating
  new substantive replies — a brief acknowledgment is fine, but let the
  human take over.
- Stay within {{business_name}}'s configured scope
  (`{{out_of_scope_topics}}`) — redirect or escalate anything outside it
  rather than improvising an answer.

# Output
Produce exactly one WhatsApp-ready reply per turn:
- Plain text, conversational, sized for a chat bubble (roughly 1–4 short
  sentences unless listing multiple catalog items, in which case use a
  short scannable list).
- Any tool calls needed for this turn, issued before the reply is
  considered final (e.g. confirm availability before promising a slot).
- No markdown headers, no code blocks — WhatsApp doesn't render them
  meaningfully.
- If handing off, the visible reply should set expectations plainly
  (e.g. "Let me get one of our team to help with that — they'll follow up
  here shortly") rather than going silent.
```

**Example instantiation** (for reference — a real-estate tenant modeled on
the sibling project's domain):
`{{agent_name}}` = "Aisha", `{{business_type}}` = "real estate agency",
`{{catalog_noun}}` = "property listings", `{{business_rules}}` includes
"viewing deposits are handled in-app via escrow, never quote a bank
account or request payment in chat."

---

## 9. Parity checklist before decommissioning any n8n workflow

For each retired workflow, confirm the new module handles:
- [ ] Every intent the old workflow handled (from your Section 2 audit)
- [ ] The same or better response latency
- [ ] Idempotent behavior under duplicate webhook delivery
- [ ] Correct tenant isolation under concurrent multi-tenant load
- [ ] Consent/opt-out behavior at least as strict as before
- [ ] A human-handoff path that actually reaches a real staff member

Only once every box is checked should the corresponding n8n workflow be
disabled (not deleted — keep it archived for a rollback window).

---

## 10. Definition of done

- New endpoint receives and correctly processes real WhatsApp traffic for
  at least one pilot tenant with zero reliance on n8n.
- A second tenant can be onboarded by adding config rows (instance,
  agent persona, catalog source) — no new code required.
- All items in Section 9 are checked for every migrated instance.
- Secrets, RLS, and idempotency requirements from Section 7 are verifiably
  in place (not just "should be fine").
- MPESA integration is **bypassed** for trial phase — bookings can be
  created without payment processing or escrow.
- Evolution API key management via admin panel is **Phase 1 decision needed**.

## 11. Trial Phase Implementation Notes

### Evolution API Key Management

**DECISION NEEDED (Phase 1)**: Should Evolution API keys be managed via:

**Option A: Admin Panel** (Recommended for trial)
- Add Evolution API key input field to Dimora admin panel
- Store keys in `whatsapp_instances.webhook_secret` field
- Include validation and testing endpoint
- Provide key rotation and audit logging

**Option B: Secret Store** (Current state)
- Continue using existing backend secret store
- No admin panel changes needed
- More secure but less accessible for trial

**Recommendation**: Choose **Option A (Admin Panel)** for trial phase to allow manual key input and testing.

### Admin Panel Integration (Option A)

**Admin Panel Features**:

1. **Key Input Interface**
   - Text field for Evolution API key
   - Validation on input (format, length)
   - Test connection button
   - Save/Cancel buttons

2. **Key Management Dashboard**
   - List of configured Evolution API instances
   - Status indicators (active/inactive)
   - Last used timestamp
   - Usage statistics

3. **Security Controls**
   - Role-based access (admin only)
   - Key masking in UI
   - Audit logging of all key operations
   - Session timeout for key management

4. **Testing & Validation**
   - Test webhook endpoint
   - Validate key format
   - Test message sending
   - Connection status monitoring

**Database Schema Additions**:

```sql
-- Enhanced whatsapp_instances table
ALTER TABLE public.whatsapp_instances
ADD COLUMN admin_panel_enabled BOOLEAN DEFAULT true,
ADD COLUMN key_validation_enabled BOOLEAN DEFAULT true,
ADD COLUMN last_tested_at TIMESTAMPTZ,
ADD COLUMN test_webhook_url TEXT,
ADD COLUMN admin_notes TEXT;
```

**Admin Panel API Endpoints**:

```typescript
// GET /api/admin/evolution-keys - List all keys
// POST /api/admin/evolution-keys - Create new key
// PUT /api/admin/evolution-keys/:id - Update key
// DELETE /api/admin/evolution-keys/:id - Delete key
// POST /api/admin/evolution-keys/:id/test - Test key connectivity
```

**Security Considerations**:

1. **Input Validation**
   - Reject keys with invalid format
   - Length limits (64+ characters)
   - Character set validation

2. **Access Control**
   - Admin role required
   - IP whitelisting (recommended)
   - MFA for key management

3. **Audit Logging**
   - Log all key operations
   - Track who accessed keys
   - Monitor for suspicious activity

4. **Key Rotation**
   - Automated key rotation schedule
   - Graceful key transition
   - Backup key storage

### Enhanced Testing Strategy

**Unit Tests**:
- Key format validation
- API endpoint testing
- Database integration tests

**Integration Tests**:
- End-to-end key flow
- Admin panel UI testing
- Security validation testing

**Load Tests**:
- Concurrent key operations
- Admin panel performance
- API rate limiting

**Monitoring & Alerting**:

1. **Key Health Monitoring**
   - Connection status
   - API rate limits
   - Error rates
   - Response times

2. **Admin Panel Monitoring**
   - Login attempts
   - Key access patterns
   - Failed operations
   - System resource usage

3. **Alert Configuration**
   - Failed key validation
   - Multiple failed login attempts
   - Unusual API usage patterns
   - System downtime

### Rollback Procedures

**Key Rollback Steps**:

1. **Backup Current Keys**
   - Export encrypted keys to backup storage
   - Document current configuration
   - Test backup restoration

2. **Rollback Triggers**
   - API connectivity failures
   - Security breaches
   - Performance degradation
   - Data corruption

3. **Rollback Process**
   - Disable new key usage
   - Restore backup keys
   - Update configuration
   - Verify system functionality

**Rollback Testing**:
- Monthly rollback drills
- Key rotation testing
- Disaster recovery testing

### Compliance & Documentation

**Documentation Requirements**:

1. **Technical Documentation**
   - API key management procedures
   - Security best practices
   - Troubleshooting guides

2. **Operational Documentation**
   - Key rotation schedule
   - Monitoring dashboards
   - Incident response procedures

3. **Compliance Documentation**
   - Key storage security
   - Access control policies
   - Audit trail retention

**Compliance Checklist**:
- ✅ Keys encrypted at rest
- ✅ Keys encrypted in transit
- ✅ Access logging enabled
- ✅ Regular key rotation
- ✅ Backup procedures documented
- ✅ Recovery procedures tested

### Implementation Timeline

**Phase 1 (Week 1-2)**: Admin panel setup
- UI design and development
- API endpoint implementation
- Database schema updates

**Phase 2 (Week 3-4)**: Security implementation
- Access control setup
- Audit logging
- Key validation

**Phase 3 (Week 5-6)**: Testing & deployment
- Unit and integration testing
- Load testing
- Production deployment

**Phase 4 (Week 7-8)**: Monitoring & documentation
- Monitoring setup
- Documentation completion
- Training materials

### Database Integration Streamlining

**Current Tables (All Required)**:
- `whatsapp_instances` - Evolution API instance config
- `conversation_sessions` - Live agent state
- `messages_log` - Full message history
- `leads` - WhatsApp leads
- `consent_log` - Marketing consent

**Streamlined Schema**:
- All tables scoped by `tenant_id` with RLS enabled
- `evolution_message_id` UNIQUE constraint for idempotency
- No additional tables needed for trial phase

### MPESA Bypass Implementation

**Bypassed Functionality**:
- `schedule_booking()` creates bookings without payment processing
- No escrow held for viewing deposits
- Bookings marked as `trial_bypassed = true`
- All other tools function normally

**Testing Strategy**:
- Focus on lead capture and conversation flow
- Verify booking creation without payment dependency
- Test consent and escalation workflows
- Validate tenant isolation and idempotency