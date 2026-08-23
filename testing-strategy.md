# Dimora — Testing Strategy

Payments + offline sync make "write some tests" dangerously insufficient. Coverage is risk-ranked; suites map directly to phase exit criteria in implementation-plan.md.

## Test pyramid for this project

### 1. RLS / policy suite (highest priority — blocks Phase 1 exit)
pgTAP-style tests running as real JWT contexts:
- Signup metadata cannot set role; profile PATCH cannot change role (audit regressions)
- Anonymous keys rejected on listing_events; signals require auth
- Agents isolated: leads, workspace items, analytics invisible cross-agent
- Evidence rows unreadable publicly; views expose only intended columns
- Booking insert rejects mismatched agent↔property; reviews only from completed own bookings

### 2. Payment state-machine tests (blocks Phase 2 exit)
Deno test against mocked Daraja endpoints:
- Happy path STK → callback → completed + booking confirmed
- Duplicate/out-of-order callbacks → single transition (idempotency guards)
- Forged callback token → 401 before DB touch; client amount ignored
- Escrow double-release/double-refund attempts → no-op; disputed excluded from both
- Auto-refund job flags exactly the right stale payments

### 3. Offline E2E (blocks Phase 3 exit)
Playwright + CDP network emulation:
- Enqueue offline → close tab → reconnect → Background Sync flushes (Chromium)
- iOS-profile run verifies online-event fallback path explicitly
- Retry cap produces dead-letter toast after 5 failures
- Replay of identical queued booking yields one row

### 4. UI contract & accessibility (Phase 4 gate)
- Component states matrix: loading/error/empty/offline per surface
- axe on every route ≥95; keyboard-only core loop; focus traps; reduced-motion diffs
- Visual checks: badge consistency across three touchpoints; token purity (no inline hex)

### 5. Performance gates (CI-blocking)
Lighthouse CI budgets: ≤200KB gz JS, TTI <3s @ Fast 3G, PWA+a11y ≥90. Red = failed build.

## Tooling
Vitest + React Testing Library (units/hooks) · Playwright (E2E/offline) · Deno test + stubbed fetch (functions) · pgTAP via Supabase local CLI (policies) · LHCI + axe (gates).

## Fixtures & data discipline
Sandbox Daraja shortcodes only; synthetic phone numbers (no real PII — DPA); seeded demo listings spanning all six property types and counties; anonymized sample images for duplicate-detection evals.

## Release checklist (per deploy)
Full green suites → migration applied cleanly on staging clone → SW cache-version bump verified → rollback drill current (money releases).
