# Dimora — Data Model Notes

13 tables. The spec §4 migration is canonical; this doc records non-obvious patterns and integrity rules so engineers don't re-derive them.

## Entity map

- **profiles** ← root identity (1:1 auth.users). Role via service-role flows only.
- **agent_kyc** — 1:1 with agent profiles; platform-level identity (KRA PIN, ID doc in private bucket).
- **properties** → agent (profiles). Soft-delete (`deleted_at`). `is_verified` is derived, never set directly. `location` GEOGRAPHY synced from lat/lng by trigger.
- **property_verifications** — join table (property × kind), UNIQUE(property_id, kind); evidence fields admin-only; public view exposes property_id/kind/created_at only.
- **bookings** → property + hunter + agent; `idempotency_key` UNIQUE for offline retries; `hunter_confirmed_viewing` gates escrow release.
- **favorites** — hunter×property composite PK.
- **agent_workspace_items** — CRM leads; `lead_source` ('manual'|'whatsapp'), `whatsapp_thread_id` idempotent per thread.
- **property_reports** — trust & safety queue, admin-read.
- **reviews** — 1:1 booking (UNIQUE booking_id), RLS-gated to completed own bookings.
- **neighborhood_signals** — crowdsourced per (county, sub_county, neighborhood).
- **payments** — ledger: purpose enum + escrow_status machine ('held' → released/refunded/disputed). NO client INSERT/UPDATE policies — service-role functions only.
- **rent_ledger** → tenant + property (+optional payment); deliberately landlord-free (future module hook).
- **listing_events** — append-only analytics; auth-required inserts.

## Patterns to preserve

1. **Derived trust**: `is_verified` recomputed by trigger from required verification kinds — never write it directly.
2. **Ledger discipline**: payment/escrow transitions only advance from defined prior states (`.eq(status,'pending')`, `.eq('escrow_status','held')`).
3. **Soft delete**: properties never hard-deleted; partial indexes respect `deleted_at IS NULL`; history preserved for disputes.
4. **Public exposure = deliberate views** (`public_profiles`, `public_property_verifications`) — new columns don't leak by default.
5. **Idempotency at schema level**: UNIQUE constraints are the final guard behind function-level guards.
6. **DPA lifecycle**: raw_callback purged @12mo; KYC tail retention; erasure = anonymization preserving FK/dispute trails.

## Integrity rules enforced in DB (not app)

Role immutability (trigger) · listing cap on insert+republish · location sync trigger · booking agent↔property match (RLS WITH CHECK) · review gating (RLS EXISTS) · updated_at triggers on hot tables.

## Indexing rationale

GIST(location) for proximity; composite (county,sub_county,neighborhood) for neighborhood aggregates (PriceComparison); partial published+verified index for the browse path; (property_id,event_type) for analytics roll-ups.
