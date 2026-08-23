# README -- Pre-Coding Resource Generation Framework

This repository (or working folder) uses a two-file handoff to bootstrap any
project before a single line of application code is written:

- **`Prompt.md`** -- the project brief. Describes what's being built, for
  whom, and any known constraints (stack preferences, integrations,
  compliance needs, timeline). *You supply this per project.* It may also be
  named `Draft.md` or `spec.md` -- same role, just read whichever is present.
- **`README.md`** *(this file)* -- the process doc. It tells an AI assistant
  (or a human) exactly what to produce from `Prompt.md` before coding starts,
  and how to decide *what's actually needed* rather than generating a fixed,
  generic set of files.

The output of this process is a **pre-coding resource pack**: agent
definitions, a team README, an implementation plan, and any supporting
scaffolding docs the project genuinely calls for.

### Output directory structure

All generated files go in the project root (same directory as `Prompt.md`):

```
project-root/
  Prompt.md                          # input (existing)
  README.md                          # this file (existing)
  agents/
    README.md                        # team roster + handoff guide (Step 3)
    <role-name>.md                   # one per agent (Step 2)
  implementation-plan.md             # phased plan (Step 4)
  scaffolding.md                     # only if warranted (Step 5)
  architecture-decisions.md          # only if warranted (Step 5)
  data-model.md                      # only if warranted (Step 5)
  testing-strategy.md                # only if warranted (Step 5)
  environments.md                    # only if warranted (Step 5)
```

Create the `agents/` directory when you reach Step 2. Do not create
supplementary docs in Step 5 unless the conditions below are met.

---

## Step 0 -- Read and confirm scope

Before generating anything:

1. Read `Prompt.md` (or `Draft.md`) in full.

2. Restate the scope using this template:

   > **What it is:** [1-2 sentences on the product's core purpose]
   > **Who uses it:** [list the user roles and their primary actions]
   > **What's out of scope:** [explicit exclusions -- what this project
   > does NOT do]
   > **Key constraints:** [stack, compliance, hosting, integration, or
   > timeline constraints that shape every downstream decision]

3. Flag ambiguities and missing information. For each one, classify it:

   | Classification | What to do |
   |---|---|
   | **Blocks agent definitions** (e.g., no auth model, no data sensitivity level, no target platform) | State a default assumption explicitly, note it in the implementation plan as a "decision needed," and proceed. Do not silently assume. |
   | **Blocks implementation details** (e.g., specific API provider, hosting region, payment threshold) | Note in the implementation plan as a "decision needed in Phase N" and proceed with the most reasonable default. |
   | **Nice-to-have clarity** (e.g., exact number of languages, specific analytics tool) | Note in a "future considerations" section of the implementation plan. Do not block on these. |

4. Classify the project along these axes, since everything downstream
   depends on this:

   | Axis | Examples | Why it matters |
   |---|---|---|
   | **Surface** | Web app, mobile app, CLI tool, API/service, browser extension, data pipeline, desktop app | Determines which engineering agents exist at all |
   | **Data layer** | None, relational, document store, vector/embedding store, geospatial, real-time streams | Determines whether a database-architect is needed and what they specialize in |
   | **Team-facing complexity** | Solo script vs. multi-tenant SaaS vs. regulated enterprise system | Determines whether devops/qa/product-manager agents earn their keep or are overhead |
   | **Novel risk area** | ML/inference, payments, health data, geolocation, offline-sync | Determines whether a specialist agent (ML engineer, security engineer, payments engineer) is required |

   This classification is the input to Step 1. **Do not skip it** -- it's
   what makes the rest of this process context-sensitive instead of
   templated.

---

## Step 1 -- Determine the agent roster (context-sensitive, not fixed)

Do not default to the "standard seven" (product manager, ui/ux, frontend,
backend, database, devops, qa) unless the project actually needs all seven.
Instead, build the roster from the classification in Step 0:

| If the project has... | Include | Skip / defer |
|---|---|---|
| Any user-facing UI | `ui-ux-engineer.md`, `frontend-engineer.md` | -- |
| No UI (pure API, CLI, cron job) | `backend-engineer.md` | `ui-ux-engineer.md`, `frontend-engineer.md` |
| Persistent structured data | `database-architect.md` | -- |
| No persistence, or a trivial local file/store | -- | `database-architect.md` |
| Multiple environments, scheduled deploys, or a team beyond one person | `devops-engineer.md` | For a solo prototype, fold this into backend-engineer's scope instead |
| Meaningful business logic, edge cases, or external users | `qa-engineer.md` | For a throwaway script, skip |
| Ambiguous or evolving requirements, multiple stakeholders | `product-manager.md` | If `Prompt.md` is already a complete, unambiguous spec, this role can be thin or skipped |
| ML/inference, ranking, recommendation, or generative features | `ml-engineer.md` | -- |
| Native mobile targets (iOS/Android) | `mobile-engineer.md` | -- |
| Payments, health data, auth-heavy or regulated domains | `security-engineer.md` | Otherwise fold security review into backend-engineer's working principles |

**Rule of thumb:** every agent added must own a distinct, real decision
surface. If two roles would spend most of their time handing off trivial
work to each other, merge them.

### Worked examples

| Project type | Step 0 classification | Agent roster | Count |
|---|---|---|---|
| **CLI tool** (single-purpose, no UI, local file output) | Surface: CLI. Data: file. Complexity: solo. Risk: none. | `backend-engineer.md` | 1 |
| **Internal dashboard** (web UI, PostgreSQL, single environment, no payments) | Surface: web app. Data: relational. Complexity: small team. Risk: none. | `ui-ux-engineer.md`, `frontend-engineer.md`, `backend-engineer.md`, `database-architect.md` | 4 |
| **SaaS MVP** (multi-tenant, auth, payments, CI/CD) | Surface: web app. Data: relational + cache. Complexity: multi-tenant SaaS. Risk: payments, auth. | `product-manager.md`, `ui-ux-engineer.md`, `frontend-engineer.md`, `backend-engineer.md`, `database-architect.md`, `security-engineer.md`, `devops-engineer.md`, `qa-engineer.md` | 8 |
| **Regulated platform** (compliance, payments, ML, multi-language, offline) | Surface: web + PWA + channels. Data: relational + geospatial + search. Complexity: regulated enterprise. Risk: payments, ML, compliance, offline. | `product-manager.md`, `ui-ux-engineer.md`, `frontend-engineer.md`, `backend-engineer.md`, `database-architect.md`, `security-engineer.md`, `ml-engineer.md`, `devops-engineer.md`, `qa-engineer.md` | 9 |

---

## Step 2 -- Generate agent definition files

For each agent selected in Step 1, produce `agents/<role-name>.md` with this
structure:

```markdown
---
name: <role-name>
description: One or two sentences on when to invoke this agent vs. others.
             Be specific enough that a router (human or AI) can pick correctly.
---

# <Role Title>

## Core skills
Elaborate, non-generic list of what this role must be good at *for this
project specifically* -- not a generic job description. E.g. for a
database-architect on a geospatial project: "PostGIS spatial indexing
strategy," not just "database design."

## Domain context you must apply
Facts about *this* project the agent should already know rather than being
re-briefed every time: the data model's quirks, known failure modes,
multi-tenancy rules, field-vs-office usage patterns, whatever is specific
to `Prompt.md`. This section goes stale fastest as the product evolves --
flag it as the part to revisit when requirements shift.

## How you work
Behavioral principles -- how this role makes decisions, what it optimizes
for, how it communicates handoffs. Not just a skills list.

## What you don't do
Explicit handoff boundaries to the adjacent agents, so responsibilities
don't silently drift or overlap.
```

### Depth guidance

Each agent file should be **300-600 words** (roughly 1-2 screens of text).
The goal is enough detail that an AI assistant or human contractor can
produce correct work without re-reading `Prompt.md` every time, but not so
much that the file becomes a novel.

- **Core skills**: 3-6 bullet points, each specific to this project. If you
  find yourself writing generic skills, the project probably doesn't need
  this agent.
- **Domain context**: 5-10 bullet points of project-specific facts. This is
  the most important section -- it's what makes the agent useful rather than
  generic. Pull directly from `Prompt.md`.
- **How you work**: 3-5 sentences on decision-making principles and
  handoff protocol.
- **What you don't do**: 2-4 bullet points naming the adjacent agents and
  what they own instead.

### Example: completed agent file

```markdown
---
name: database-architect
description: Use when designing or modifying the PostgreSQL schema, migrations,
             row-level security policies, PostGIS spatial setup, or consent-scoped
             data access patterns. Invoke before any backend engineer touches
             schema-related code.
---

# Database Architect

## Core skills
- PostgreSQL schema design with 26+ tables, complex foreign key relationships,
  and JSON column usage for flexible fields (survey responses, performance summaries)
- Row-level security (RLS) policies that enforce consent-based data access --
  ensuring field agents only see contacts in their assigned ward
- PostGIS spatial indexing for ward boundary queries, heatmaps, and agent GPS tracking
- ElasticSearch index design for fuzzy contact search (name, phone, location)
- Encryption-at-rest strategy for PII fields (phone numbers, names) with
  hashed lookup indexes
- Migration strategy for a schema that will evolve across 5 phases without downtime

## Domain context you must apply
- The `contact` table is the root of the entire data model. Every other table
  hangs off it via foreign keys. Protect its integrity above all else.
- Consent records are the DPA-critical audit trail. The schema must make it
  structurally impossible to query a contact without also surfacing their
  consent status.
- Ward-level aggregate queries are the primary analytical workload. Design
  indexes and materialized views for fast ward/constituency/county roll-ups.
- The `segment` table stores query definitions (JSON), not materialized lists.
  Segments are re-evaluated at query time against the contact + interaction data.
- All PII columns (phone_number, name) use application-level encryption with
  a separate key, plus a hashed version for lookup joins.

## How you work
- Every schema change requires a migration plan and a rollback plan.
- You optimize for query performance on aggregate ward-level queries, not
  individual contact lookups (the latter is rare in production).
- You enforce that no table can store individual-level psychographic scores --
  the `aggregate_only` boolean on `segment` is your structural guardrail.
- You hand off to backend-engineer after schema design, and to ml-engineer
  when aggregate model tables need new columns.

## What you don't do
- You do not write API endpoints or business logic (backend-engineer owns that).
- You do not design the UI for data display (ui-ux-engineer and frontend-engineer).
- You do not implement the LLM classifier or message testing logic (ml-engineer).
- You do not set up infrastructure or deployment pipelines (devops-engineer).
```

These files are written to be dropped into `.claude/agents/` for use as
Claude Code subagents, or pasted as system prompts for any AI assistant, or
handed to a human contractor as a briefing doc.

---

## Step 3 -- Generate the team README

Once the agent files exist, produce `agents/README.md` containing:

1. **One-line roster description**: "A [N]-agent team for [project name],
   scoped to [primary surface] with [key risk domain] expertise."

2. **Roster table**:

   | File | Role | Owns |
   |---|---|---|
   | `product-manager.md` | Product Manager | Requirements clarification, feature prioritization, stakeholder alignment |
   | ... | ... | ... |

3. **Handoff orders for typical feature types** specific to *this* project.
   Include 3-5 scenarios that cover the most common workflows. Examples:

   | Scenario | Handoff order |
   |---|---|
   | New UI screen | `ui-ux-engineer -> frontend-engineer -> qa-engineer` |
   | New data model + API | `database-architect -> backend-engineer -> qa-engineer` |
   | New compliance rule | `security-engineer -> backend-engineer -> qa-engineer` |
   | New ML feature | `ml-engineer -> backend-engineer -> qa-engineer` |
   | Infrastructure change | `devops-engineer -> backend-engineer -> qa-engineer` |

4. **Usage instructions** for Claude Code (`.claude/agents/` drop-in) and
   for using the files standalone with any assistant.

5. **Maintenance note**: "When `Prompt.md` changes, update the 'Domain context'
   section of every affected agent file. The roster itself only changes if
   the project's risk profile or surface count shifts."

---

## Step 4 -- Generate `implementation-plan.md`

Produce `implementation-plan.md` in the project root.

### How to build the plan

1. **Check `Prompt.md` for an existing build sequence.** If one exists,
   use it as the starting point. Expand each phase with the details below.
   If none exists, create phases from scratch based on the Step 0
   classification and agent roster.

2. **Order phases by dependency and risk**, not by role convenience. If
   the hardest unknown is the LLM integration, de-risk it in Phase 1 even
   if the "natural" order would put it in Phase 3. State the reasoning
   explicitly.

3. **For each phase, specify:**

   | Field | Required | Example |
   |---|---|---|
   | **Goal** | Yes | "Campaign can capture contacts with verified consent and deploy field agents." |
   | **Scope** | Yes | Concrete deliverables, each tagged to a specific agent from the roster |
   | **Sequencing** | Yes | What blocks what. What can run in parallel. Dependencies between deliverables within the phase. |
   | **Exit criteria** | Yes | Testable conditions that prove the phase is complete. Not "code written" -- "a field agent can capture a contact offline, sync when online, and the contact appears in admin dashboard with consent provenance." |
   | **Decisions needed** | If applicable | Open questions from Step 0 that must be resolved during this phase |
   | **Risks** | If applicable | What could go wrong, and the mitigation |

4. **Include a "Future considerations" section** at the end for items
   flagged in Step 0 that didn't block execution but should be resolved
   eventually.

### Length guidance

The implementation plan should be **1-3 pages** (roughly 500-1500 words)
depending on project complexity. A 2-day CLI tool gets a 1-page plan with
2 phases. A regulated platform gets a 3-page plan with 5 phases.

---

## Step 5 -- Generate supplementary scaffolding docs (only if warranted)

Not every project needs these. Generate a doc only if the condition is met:

| Doc | Generate it when... | Skip it when... |
|---|---|---|
| `scaffolding.md` | The project has 3+ distinct modules/packages/services with non-obvious dependency relationships. A monorepo with `api/`, `web/`, `workers/`, `shared/` warrants this. | Single-package project, or the directory structure is obvious from the stack (e.g., a standard Next.js app). |
| `architecture-decisions.md` (ADR log) | There are 2+ viable technical approaches for a decision that will be expensive to reverse (e.g., NestJS vs Django, self-hosted LLM vs API, PostgreSQL vs DynamoDB). | The tech choices are obvious or already locked in by `Prompt.md`. |
| `data-model.md` | The schema has 15+ tables, complex relationships, or non-obvious patterns (e.g., JSON columns storing query definitions, consent-scoped access). | Simple CRUD with fewer than 10 tables. |
| `testing-strategy.md` | The project involves regulated data (health, financial, political), payments, or offline-sync -- areas where "write some tests" is dangerously insufficient. | Internal tools, prototypes, or projects with no compliance or financial risk. |
| `environments.md` | The project deploys to 3+ distinct environments (dev/staging/prod, or Kenya-hosted + local-dev + CI), or has environment-specific configuration that matters. | Single-environment deploy, or environments that are identical copies. |

**Heuristic:** if you have to think for more than 10 seconds about whether
a doc is warranted, it probably is. Err on the side of generating it --
but keep it short and useful, never filler.

---

## Quality checklist before coding begins

Run through this checklist after completing all steps. Every item must be
verifiable by inspecting the generated files.

- [ ] **Scope confirmed**: The Step 0 restatement accurately reflects
  `Prompt.md`. Every ambiguity has a classification (blocks agent defs /
  blocks implementation / nice-to-have) and a resolution (default assumed /
  noted for later).

- [ ] **Classification complete**: All four axes (Surface, Data layer,
  Complexity, Risk) are filled in with project-specific values, not
  left as "N/A" or generic placeholders.

- [ ] **Agent roster justified**: Every agent in the roster maps to at
  least one row in the Step 1 inclusion table. No agent exists because
  "it's usually included." Count matches the project's complexity class.

- [ ] **Agent files complete**: Every agent file has all five sections
  (name/description, core skills, domain context, how you work, what you
  don't do). Core skills reference project-specific technologies, not
  generic competencies. Domain context pulls from `Prompt.md`, not from
  general knowledge.

- [ ] **Handoff boundaries non-overlapping**: For every pair of adjacent
  agents, the "what you don't do" section of each names the other and
  specifies who owns the shared boundary. No two agents claim the same
  decision surface.

- [ ] **Team README handoff orders match this project**: The 3-5 scenarios
  in the team README reflect actual feature types from `Prompt.md`, not
  generic web-app scenarios. A compliance-heavy project should have a
  compliance-related scenario. A payments-heavy project should have a
  payments scenario.

- [ ] **Implementation plan phases ordered by real dependency**: Check that
  no phase depends on output from a later phase. Verify that riskiest
  unknowns are addressed early (or explicitly justified if deferred). Every
  phase has testable exit criteria, not activity descriptions.

- [ ] **Supplementary docs justified**: Each generated doc in Step 5 has
  a corresponding row in the Step 5 table whose condition is clearly met.
  No filler docs. If a doc was skipped, the skip condition is met.

- [ ] **No orphaned references**: Every agent name referenced in the
  implementation plan's deliverables exists as an actual agent file. Every
  handoff order in the team README names actual agents.
