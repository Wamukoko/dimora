# Dimora Agent Team — Roster & Handoff Guide

A 9-agent team for **Dimora**, scoped to an offline-first Kenyan proptech PWA with deep **payments (M-PESA), trust-verification, and data-protection** expertise.

## Roster

| File | Role | Owns |
|---|---|---|
| `product-manager.md` | Product Manager | Open-decision register, phase gating, scope guard against landlord-module creep |
| `ui-ux-engineer.md` | UI/UX Engineer | Design tokens (§3), custom icon set, Verified Badge signature element, interaction specs incl. offline states |
| `frontend-engineer.md` | Frontend Engineer | React 18/TS app, PWA wiring, offline queue UX, perf-budget compliance in src/ |
| `backend-engineer.md` | Backend Engineer | Deno edge functions (stk-push, mpesa-callback, release/refund-escrow, whatsapp-webhook), Daraja/WhatsApp/SMS integrations, scheduled jobs |
| `database-architect.md` | Database Architect | Migrations, PostGIS, RLS policies, triggers, views, retention/anonymization jobs |
| `security-engineer.md` | Security Engineer | Threat models, adversarial RLS review, secret management, DPA checks, phase P1/P2 signoff |
| `ml-engineer.md` | ML Engineer | Phase 5 only: AI listing writeups, perceptual-hash duplicate detection |
| `devops-engineer.md` | DevOps Engineer | CI/CD, environments & secrets promotion, Lighthouse CI gates, monitoring, rollback drills |
| `qa-engineer.md` | QA Engineer | Test strategy execution: RLS suites, payment idempotency, offline E2E, a11y, perf evidence |

## Handoff orders — typical Dimora feature types

| Scenario | Handoff order |
|---|---|
| New hunter-facing screen (e.g., neighborhood signal cards) | `ui-ux-engineer → frontend-engineer → qa-engineer` |
| Payment/escrow flow change (e.g., auto-refund timeout) | `product-manager (decision) → security-engineer (review) → backend-engineer → database-architect (if ledger touched) → qa-engineer` |
| Schema change / new table | `database-architect → backend-engineer → security-engineer (RLS attack pass) → qa-engineer` |
| Verification workflow extension (e.g., registry crosscheck) | `product-manager → database-architect → backend-engineer → frontend-engineer (admin queue UI) → qa-engineer` |
| Offline behavior change (new queued action type) | `frontend-engineer ↔ backend-engineer (payload contract) → qa-engineer (offline E2E) → security-engineer (server-side validation)` |
| Phase 5 ML feature (writeups, duplicate detection) | `ml-engineer (prototype + ADR) → product-manager (cost approval) → backend-engineer → qa-engineer` |

## Usage

- **Claude Code**: drop the `agents/` folder into `.claude/agents/`; each frontmatter description routes tasks to the right subagent.
- **Any other assistant**: paste the relevant agent file as its system prompt, then attach only the task + touched spec sections.
- Always pair a task with the exact Dimora_README.md section numbers — agents assume the spec is canonical.

## Maintenance

When `Dimora_README.md` changes, update the **Domain context** section of every affected agent file. The roster itself changes only if the risk profile shifts (e.g., landlord module greenlit → revisit roles; native mobile → add mobile-engineer).
