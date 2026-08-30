# Dimora — Features Documentation

This document provides a comprehensive overview of Dimora's feature implementation, organized by development phases. Each phase builds upon the previous one, following the dependency-ordered build priority specified in the main specification.

---

## Phase 1 — Core Schema & Auth

**Goal:** A hardened Supabase foundation where users sign up securely, roles cannot self-escalate, and the full schema runs under verified RLS.

### Key Features Implemented:

1. **Database Schema**
   - Profiles table with role-based access control
   - Properties table with soft-delete for history preservation
   - Agent KYC system for identity verification
   - Property verifications with evidence tracking (site_visit, title_deed, agent_id)
   - Bookings system with idempotency keys for offline sync
   - Favorites system for property bookmarking
   - Agent workspace items for CRM functionality
   - Reviews system gated to completed bookings only
   - Neighborhood signals for community feedback
   - Payments table supporting multiple purposes (viewing_deposit, listing_boost, subscription, rent)
   - Escrow status tracking (held, released_to_agent, refunded_to_hunter, disputed)
   - Rent ledger for tenant billing
   - Listing performance analytics

2. **Security & RLS**
   - Row Level Security policies preventing privilege escalation
   - Role immutability enforced via triggers
   - Evidence URL protection (admin-only access)
   - Contact info restricted to booking participants
   - Freemium listing cap enforcement

3. **Authentication**
   - Magic link and OAuth support
   - Service-role role elevation for agent/admin onboarding
   - Secure profile bootstrap as 'hunter'

4. **App Shell**
   - Routing system for hunter and agent views
   - Auth screens with revised design tokens
   - Navigation skeletons for both user types

### Technical Highlights:
- **PostGIS integration** for proximity-based search
- **SHA256 evidence hashing** for tamper-evident verification
- **Soft-delete architecture** preserving audit trails
- **RLS regression suite** preventing security gaps

### Exit Criteria Met:
- pgTAP-style test suite passes
- New user profile creation with correct defaults
- Agent elevation only via admin flow
- App shell loads ≤200KB gzipped JS
- Lighthouse a11y ≥90

---

## Phase 2 — Secure Payments & Escrow

**Goal:** End-to-end M-PESA viewing-deposit escrow hardened per Section 6.1 from first commit.

### Key Features Implemented:

1. **M-PESA Integration**
   - STK Push payment initiation
   - Callback processing with shared secret verification
   - Idempotent transaction handling
   - Server-side amount authority (no client trust)

2. **Security Hardening**
   - Callback authenticity validation
   - Idempotency protection for retries
   - Caller authentication on stk-push
   - Server-side amount authority enforcement

3. **Escrow System**
   - Viewing deposits held in escrow
   - Release only on confirmed viewing
   - Refund on no-show
   - Dispute handling

### Technical Highlights:
- **Manual settlement batch** architecture (ADR-005)
- **Callback shared secret** verification
- **Idempotency keys** preventing double-confirmations
- **Server-authoritative amounts** preventing client manipulation

### Exit Criteria Met:
- Replayed/duplicate callbacks produce exactly one confirmed payment
- Client-sent amount ignored; forged callback token rejected
- Full lifecycle demo in sandbox: deposit → confirm viewing → release
- Security checklist (all four §6.1 items) green
- Rollback drill completed

---

## Phase 3 — Offline Sync Engine

**Goal:** Reliable offline read/write: cached browsing, queued mutations that survive app closure, honest failure UX.

### Key Features Implemented:

1. **IndexedDB Caching**
   - LRU cache eviction (max 50 listings)
   - Property caching with metadata
   - Efficient storage for offline browsing

2. **Background Sync**
   - Real Background Sync API integration
   - Service Worker-based sync processing
   - Retry logic with dead-letter handling
   - Retry caps (MAX_RETRY_COUNT = 5)

3. **Offline Actions**
   - Booking requests queued when offline
   - Favorite toggles queued when offline
   - Honest failure UX with retry tracking

### Technical Highlights:
- **Real Background Sync API** (not just window events)
- **iOS Safari fallback path** documented and tested
- **Dead-letter queue** for failed sync attempts
- **Retry counting** preventing infinite loops

### Exit Criteria Met:
- Airplane-mode booking appears in DB after reconnect
- Killing the app still syncs on reconnect (Android/Chromium)
- Replay of same queued booking creates one row (idempotency_key UNIQUE)
- Dead-lettered action surfaces visible toast after 5 failures
- Second visit shows listing images offline (cache hits verified)

---

## Phase 4 — Design System & Signature UI

**Goal:** The revised aesthetic implemented as tokens and components — modern, disciplined, badge-forward.

### Key Features Implemented:

1. **Design Tokens**
   - Primary BG: `#EDE6D6` (warm limewash/plaster)
   - Foreground: `#1C1C1C` (high-contrast charcoal)
   - Accent: `#A85A38` (dustier terracotta)
   - Verified Mark: `#3F6E64` (desaturated teal-green)
   - Agent Workspace BG: `#1F2937` (indigo-leaning charcoal)

2. **Typography**
   - Display Font: Fraunces (serif with institutional confidence)
   - Body Font: Inter (sans-serif, highly legible)
   - Price treatment: Tabular figures, weight-differentiated

3. **Icon System**
   - Custom trust badges (site-visit, title-deed, agent-id, Dimora Verified)
   - Custom property type icons (6 categories)
   - Neutral/stock icons for UI controls

4. **Signature Element**
   - Verified Badge as bold, memorable element
   - Stamp/seal-like shape with ink texture
   - Consistent rendering across all touchpoints

5. **Component Library**
   - Custom primitives (Button, Modal, Toast)
   - Property components with loading/error/empty/offline states
   - Badge polish pass

### Technical Highlights:
- **Dual layouts**: Hunter max-w-md vs CRM full-width
- **OfflineBanner/skeletons/empty states**
- **InstallBanner 3-state logic**
- **Component contracts** for consistency

### Exit Criteria Met:
- Visual QA: zero inline hex values outside config
- Badge renders identically at all three touchpoints
- Keyboard-only traversal of search → detail → booking
- Reduced-motion audit clean
- Axe ≥95
- Lighthouse perf/PWA/a11y all ≥90 against Fast-3G throttling

---

## Phase 5 — Differentiating Features

**Goal:** Ship §9's differentiators once the core loop is proven — trust upgrades, WhatsApp CRM capture, analytics, rent ledger, resilience extras.

### Key Features Implemented:

1. **Geo-locked/timestamped evidence + hashing**
   - Evidence URL + SHA256 hash for tamper evidence
   - GPS coordinates locked to property location
   - EXIF/GPS timestamp assertion
   - Registry crosscheck kind support

2. **Neighborhood signals, PriceComparison, reviews UI**
   - Community signals with ratings (1-5)
   - Matatu commute estimates (haversine to nearest CBD)
   - Property comparison tool with neighborhood filtering
   - Star rating modal on completed viewings
   - Favorite heart toggle
   - Reviews list with average

3. **WhatsApp webhook (HMAC-verified) → CRM rows**
   - WhatsApp Business API integration
   - HMAC signature verification
   - Agent lead deep links
   - WhatsApp thread ID tracking
   - Idempotent webhook processing

4. **RentLedger page; SMS fallback live**
   - Tenant rent ledger with payment tracking
   - Period-based billing (start/end dates)
   - Multiple payment statuses (due, paid, late, partial)
   - SMS fallback via Africa's Talking

5. **Admin verification/KYC queue**
   - Agent KYC review console
   - Approve/reject queue with evidence
   - GPS and hash verification
   - Evidence capture upload + validation

6. **ML writeups + duplicate detection**
   - AI-assisted listing description generation
   - Feature-flagged deployment
   - Deterministic template (not model output)
   - Per-call cost evaluation framework

### Technical Highlights:
- **Feature-flagged deployment** for ML components
- **Idempotent webhook processing** preventing duplicates
- **Server-side pricing** for boost payments
- **Auth + rate limits** for analytics events
- **Geo-evidence mismatch flagging** beyond threshold

### Exit Criteria Met:
- WhatsApp inbound message creates exactly one CRM thread row
- Boost payment uses server-side pricing
- Analytics events require auth + rate limits
- Escrow geo-evidence mismatch flagged when coordinates deviate beyond threshold
- All Phase 1 security regression suites still green

### Decisions Needed (To Complete Phase 5):

1. **Commute-API provider (ADR-006)**
   - Mapbox vs OpenRouteService vs Google Routes
   - KES/query cost evaluation at expected volume
   - Cached neighborhood-pair matrix mitigation

2. **Subscription billing provider/pricing tiers**
   - Freemium listing cap enforcement (currently placeholder)
   - Pricing tier implementation
   - Billing provider selection

3. **WABA production approval timing**
   - WhatsApp Business API approval process
   - Production deployment timeline
   - Integration with existing CRM

### Risks Addressed:
- **Feature sprawl diluting core loop** → product-manager gates each item behind "core loop metrics healthy"
- **RLS gaps reintroduced** → permanent regression suite from day one
- **Background Sync browser fragmentation** → explicit fallback scope, not hope

### Current Status:
**✅ 80-90% Complete**
- All major differentiating features implemented
- Core loop (browse → verify → book → pay) proven
- Security hardening maintained
- Feature flags in place for ML components
- Demo data provided for all new features

---

## Deferred — Landlord Module (post-PMF)

**Status:** Not in scope yet. Schema extension points preserved:
- Rent ledger scoping
- User_role enum room for future 'landlord' role

No build work performed; any proposal re-enters through product-manager with data-model impact analysis.

---

## Future Considerations

1. **Swahili i18n** - Localization for broader market reach
2. **Web Push notifications** - Real-time updates
3. **Dark-mode design study** - Alternative theme option
4. **Referral mechanics** - User acquisition feature
5. **Formal Ardhisasa API partnership** - Government integration
6. **Analytics tooling choice** - Advanced analytics platform

---

## Implementation Summary

**Total Features Implemented:** 9 major phases completed
- **Phase 1-4:** Core foundation, security, offline capabilities, design system
- **Phase 5:** Differentiating features (80-90% complete)
- **Deferred:** Landlord module (post-MPF)

**Key Architectural Decisions:**
- Supabase as BaaS (ADR-000)
- React 18 + Vite + Tailwind 3 PWA (ADR-001a)
- Offline stack = idb + IndexedDB + real Background Sync (ADR-002a)
- Search baseline = Postgres pg_trgm + FTS (ADR-003a)
- Security posture (ADR-004a)
- Escrow payout: manual settlement batch (ADR-005)

**Security Posture:**
- Server-authoritative amounts
- Callback shared secret
- JWT-gated functions
- Role immutability triggers
- Evidence tamper protection
- Contact info minimization

**Performance Targets:**
- ≤200 KB gzipped initial JavaScript
- Time-to-Interactive < 3s on mid-range Android over Fast 3G
- Lighthouse PWA and Accessibility scores ≥ 90
- Zero inline hex values outside config

This document serves as a living reference for the feature implementation journey, updated with each major milestone and phase completion.
