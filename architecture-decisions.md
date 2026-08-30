# Dimora — Architecture Decision Records

Statuses: **Decided** (locked by spec/audit) · **Pending** (open, owner + due phase).

## Decided

- **ADR-000 Supabase as BaaS** — Postgres+RLS+PostGIS+Edge Functions+Auth in one; solo-friendly ops; Kenya-latency acceptable. Locked by spec §2.
- **ADR-001a React 18 + Vite + Tailwind 3 PWA** — locked by spec §2; vite-plugin-pwa with workbox runtime caching incl. images.
- **ADR-002a Offline stack = idb + IndexedDB + real Background Sync API** — spec §5 mandates real BS over window-event-only; iOS fallback documented.
- **ADR-003a Search baseline = Postgres pg_trgm + FTS + structured filters** — no external search service under ~100k listings (spec §9.2).
- **ADR-004a Security posture** — server-authoritative amounts, callback shared secret, JWT-gated functions, role immutability triggers. Non-negotiable (spec §6.1, audit pass).
- **ADR-005 Escrow payout: manual settlement batch** *(owner: product-manager + security-engineer)* — decided for MVP. Automated Daraja B2C per release was the alternative; rejected for MVP due to B2C limits and integration risk. Ledger stays identical under either option: escrow rows reach `released_to_agent` only from `held`, and money actually moves via ops SOP (daily batch + reconciliation). Decision gates production launch only; revisit before Phase-5 scale-out.

## Pending

- **ADR-006 Commute-time provider** *(owner: product-manager; due: Phase 5 start)*
  **STATUS: BLOCKED** - Implementation requires completion of Phase 5 decisions. 
  Mapbox vs OpenRouteService vs Google Routes. Decide on KES/query at expected volume; mitigate via cached neighborhood-pair matrix regardless of choice.
  
  **RECOMMENDED ACTION:** 
  1. Evaluate current neighborhood-pair matrix implementation in `src/lib/demoData.ts` and `src/pages/PropertyDetail.tsx`
  2. Benchmark existing haversine implementation against API options
  3. Choose provider based on cost-volume analysis and Kenya-specific coverage
  4. Implement cached matrix as fallback regardless of choice

- **ADR-007 Client data-fetching/state libraries** *(owner: frontend-engineer; due: Phase 1)*
  **STATUS: DECIDED** - TanStack Query implementation in progress
  Recommendation: TanStack Query (+ Zustand only if cross-cutting UI state demands it). Rationale: cache-first reads map cleanly onto IndexedDB mirror pattern; avoids Redux boilerplate.
  
  **RECOMMENDED ACTION:** Complete TanStack Query integration for all data fetching

- **ADR-008 Forms & validation** *(owner: frontend-engineer; due: Phase 1)*
  **STATUS: DECIDED** - react-hook-form implementation in progress
  Recommendation: react-hook-form + zod schemas shared with edge-function input validation types where feasible.
  
  **RECOMMENDED ACTION:** Complete form validation integration across all forms

- **ADR-009 LLM provider for listing writeups** *(owner: ml-engineer → product-manager cost approval; due: Phase 5)*
  **STATUS: IMPLEMENTED (Feature-flagged)** - listing-writeup function deployed
  Evaluate on per-call KES at expected volume + output-quality evals; feature-flagged, async generation.
  
  **RECOMMENDED ACTION:** 
  1. Implement cost tracking and approval workflow
  2. Set up per-call KES evaluation framework
  3. Add output quality evaluation metrics
  4. Complete async generation pipeline

## Process

New ADRs follow one-paragraph context → options → recommendation → owner sign-off. Any decision reversing a **Decided** row requires a written spec revision to Dimora_README.md first.
