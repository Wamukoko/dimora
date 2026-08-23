# Dimora — Implementation Plan

Phases follow the spec's §0 build order (dependency- and risk-ordered). Riskiest unknowns — money movement and RLS integrity — are deliberately front-loaded. Every phase has testable exit criteria; QA signs them off, security signs P1–P2.

---

## Phase 1 — Core Schema & Auth

**Goal:** A hardened Supabase foundation where users sign up securely, roles cannot self-escalate, and the full schema (§4) runs under verified RLS.

**Scope**
- Execute/extend the §4 migration; seed scripts for demo counties/listings (`database-architect`)
- Auth flows: magic link + OAuth; profile bootstrap as `hunter`; service-role role-elevation function for agent/admin onboarding (`backend-engineer`, `database-architect`)
- App shell: routing, auth screens, hunter + agent nav skeletons in revised design tokens (`frontend-engineer` per `ui-ux-engineer` specs)
- CI scaffold with Lighthouse budgets wired (`devops-engineer`)

**Sequencing:** Migration → RLS test suite → auth functions → app shell. RLS tests block everything else.

**Exit criteria**
- pgTAP-style suite passes: signup metadata `role:'admin'` yields `hunter`; profile PATCH changing role raises exception; anonymous event insert rejected; evidence unreadable publicly
- New user → profile row exists with correct defaults; agent elevation only via admin flow
- App shell loads ≤200KB gzipped JS, Lighthouse a11y ≥90

**Decisions needed:** none blocking.

**Risks:** RLS gaps reintroduced by later features → permanent regression suite from day one.

---

## Phase 2 — Secure Payments & Escrow (highest-risk phase)

**Goal:** End-to-end M-PESA viewing-deposit escrow: push → callback → held → released/refunded/disputed, hardened per §6.1 from first commit.

**Scope**
- `stk-push`, `mpesa-callback`, `release-escrow`, `refund-escrow` functions; server-side amounts; idempotent transitions (`backend-engineer`)
- Ledger-state machine review + payout-mechanism ADR decision (B2C vs manual batch) (`security-engineer`, `product-manager`)
- Booking payment UI: STK trigger modal, status polling, confirmation states incl. SMS fallback stub (`frontend-engineer`)
- 72h auto-refund flagging job (`database-architect`, `backend-engineer`)

**Sequencing:** Contract tests against mocked Daraja → sandbox E2E → UI. Payout execution can trail ledger states behind an interface.

**Exit criteria**
- Replayed/duplicate callbacks produce exactly one confirmed payment (automated)
- Client-sent amount ignored; forged callback token rejected 401; double release/refund impossible
- Full lifecycle demo in sandbox: deposit → confirm viewing → release; no-show path → refund
- Security checklist (all four §6.1 items) green; rollback drill completed

**Decisions needed:** **Payout mechanism (ADR-001)** — blocks production launch, not development.

**Risks:** Daraja sandbox ≠ production behavior → keep staging parity long-lived before cutover.

---

## Phase 3 — Offline Sync Engine

**Goal:** Reliable offline read/write: cached browsing, queued mutations that survive app closure, honest failure UX.

**Scope**
- IndexedDB LRU cache (50 listings), sync queue w/ retry caps and dead-letter toasts (`frontend-engineer`)
- Real Background Sync registration + SW processing sharing pure logic modules (`frontend-engineer`, per scaffolding.md constraints)
- Image runtime caching (CacheFirst, 7-day expiry) via workbox config (`frontend-engineer`)
- iOS Safari fallback path documented and tested (online-event flush)

**Sequencing:** idb layer → queue UX → SW integration → image caching.

**Exit criteria**
- Airplane-mode booking appears in DB after reconnect; killing the app still syncs on reconnect (Android/Chromium)
- Replay of same queued booking creates one row (idempotency_key UNIQUE)
- Dead-lettered action surfaces visible toast after 5 failures
- Second visit shows listing images offline (cache hits verified)

**Decisions needed:** none blocking.

**Risks:** Background Sync browser fragmentation → fallback is explicit scope, not hope.

---

## Phase 4 — Design System & Signature UI

**Goal:** The revised aesthetic (§3) implemented as tokens and components — modern, disciplined, badge-forward.

**Scope**
- Tailwind token map, Fraunces/Inter self-hosted subsets, tabular price treatment (`ui-ux-engineer`, `frontend-engineer`)
- Custom TrustBadgeIcons (4) + PropertyTypeIcons (6); VerifiedBadge stamp element w/ ink texture across card/detail/profile (`ui-ux-engineer`)
- Dual layouts: hunter max-w-md vs CRM full-width; OfflineBanner/skeletons/empty states; InstallBanner 3-state logic (`frontend-engineer`)
- Component contracts incl. loading/error/empty/offline states for every surface (`ui-ux-engineer`)

**Sequencing:** Tokens → primitives (Button/Modal/Toast) → property components → badge polish pass last.

**Exit criteria**
- Visual QA: zero inline hex values outside config; badge renders identically at all three touchpoints
- Keyboard-only traversal of search → detail → booking; reduced-motion audit clean; axe ≥95
- Lighthouse perf/PWA/a11y all ≥90 against Fast-3G throttling

**Decisions needed:** none blocking.

**Risks:** Custom icons slipping to stock packs → treat icon set as its own deliverable with review gate.

---

## Phase 5 — Differentiating Features

**Goal:** Ship §9's differentiators once the core loop is proven — trust upgrades, WhatsApp CRM capture, analytics, rent ledger, resilience extras.

**Scope (each gated independently)**
- Geo-locked/timestamped evidence fields + evidence hashing; registry-crosscheck kind (`backend-engineer`, `database-architect`)
- Neighborhood signals, PriceComparison, reviews UI (`frontend-engineer`)
- `whatsapp-webhook` (HMAC-verified) → CRM rows; ListingAnalyticsPanel + boost flow (`backend-engineer`, `frontend-engineer`)
- RentLedger page; SMS fallback live via Africa's Talking (`backend-engineer`)
- Admin verification/KYC queue (agent_kyc review, disputes) (`frontend-engineer`, `backend-engineer`)
- ML writeups + duplicate detection behind flags (`ml-engineer`)

**Exit criteria**
- WhatsApp inbound message creates exactly one CRM thread row (idempotent webhook)
- Boost payment uses server-side pricing; analytics events require auth + rate limits hold under load test
- Escrow geo-evidence mismatch flagged when coordinates deviate beyond threshold
- All Phase 1 security regression suites still green

**Decisions needed:** commute-API provider (ADR-002), subscription billing provider/pricing tiers, WABA production approval timing.

**Risks:** Feature sprawl diluting core loop → product-manager gates each item behind "core loop metrics healthy."

---

## Deferred — Landlord Module (post-PMF)

Schema extension points preserved (rent_ledger scoping, user_role enum room). No build work; any proposal re-enters through product-manager with data-model impact analysis.

## Future Considerations

Swahili i18n · Web Push notifications · dark-mode design study · referral mechanics · formal Ardhisasa API partnership · analytics tooling choice.
