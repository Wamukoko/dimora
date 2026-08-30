# Dimora — Environments & Configuration

Three environments with materially different externals (not identical copies): **local**, **staging**, **production**.

## Matrix

| Concern | Local dev | Staging | Production |
|---|---|---|---|
| Supabase project | Local CLI / free project | Staging project | Prod project |
| `MPESA_ENVIRONMENT` | sandbox | sandbox | production (after Safaricom go-live approval) |
| Daraja creds | Sandbox key/secret/passkey, shortcode 174379 | Same sandbox set | Production credentials, real shortcode |
| WhatsApp | Not wired | WABA test number | Approved WABA number + token |
| SMS gateway | Mocked | Test account (Africa's Talking) | Live account |
| Secrets store | `.env.local` (2 vars) + local functions env | GitHub Environment: staging → `supabase secrets set` | GitHub Environment: production (protected) |
| ODPC registration | n/a | n/a | Required before real personal data |
| Monitoring | console | Sentry staging project | Sentry prod + payment-callback failure alerts |

## Client-side vars — exactly two

`.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Nothing else is ever public; audit for drift in CI.

## Edge-function secrets (per environment)

`MPESA_CONSUMER_KEY/SECRET/PASSKEY/SHORTCODE`, `MPESA_ENVIRONMENT`, `MPESA_CALLBACK_SECRET`, `WHATSAPP_BUSINESS_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `SMS_GATEWAY_VENDOR` (`africastalking` or unset to stub), `SMS_GATEWAY_API_KEY/USERNAME/FROM`, `ML_FEATURE_FLAGS` (comma-separated, e.g. `listing_writeup`).

Rules: distinct `MPESA_CALLBACK_SECRET` per environment · rotation quarterly + on any suspected exposure · secrets never in client bundle or logs.

## Deploy flow

PR → CI gates (typecheck, suites, Lighthouse budgets) → merge → staging auto-deploy (migrations via `supabase db push`, then `functions deploy`) → manual promotion to production (protected environment, two-person rule for money-path changes).

### Automated deploy (`.github/workflows/deploy.yml`)

Runs on every push to `master` (and `workflow_dispatch`): links the Supabase project, applies pending migrations, deploys all nine edge functions (JWT-protected ones with `--verify-jwt`; the `mpesa-callback`, `whatsapp-webhook`, `sms-notify` webhooks with `--no-verify-jwt` since they use shared-secret/HMAC/auth headers instead), syncs non-empty edge-function secrets, then builds the PWA and ships it to Vercel production.

**Required GitHub secrets** (set in the repo's Actions secrets):

| Secret | Source |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access tokens |
| `SUPABASE_PROJECT_REF` | Supabase → Project Settings → Reference (e.g. `ucusorgnazdroskgtmhf`) |
| `SUPABASE_DB_PASSWORD` | Set when creating the Supabase project |
| `VERCEL_TOKEN` | Vercel → Account settings → Tokens |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Vercel project → Settings → General |

Optional edge-function secrets (skipped when unset): `MPESA_CONSUMER_KEY/SECRET/PASSKEY/SHORTCODE`, `MPESA_ENVIRONMENT`, `MPESA_CALLBACK_SECRET`, `WHATSAPP_*`, `SMS_GATEWAY_*`, `ML_FEATURE_FLAGS`. `MPESA_CALLBACK_SECRET` is required for payment callbacks to authenticate.

**One-time setup (no Docker/CLI needed beyond this):**

1. **Supabase**: create the free project, run the migrations in order via the dashboard **SQL editor** (`20260101…init`, `…0202…auto_refund_cron`, `…0303…differentiators`, `…0404…crm_lead_email`, `…0505…analytics_rate_limit`), then `seed.sql`. Enable Email + Google providers under **Authentication → Providers**. Storage bucket `property-images` and its policies are created by migration 001.
2. **Vercel (one-time on your machine)**: run `npx vercel login && npx vercel link --yes --project <name>` inside `dimora-pwa/` (creates the project *without* a git hook), or import the repo from the dashboard and then — since the workflow already deploys — disable Vercel's auto-deploy (Project Settings → Git → deactivate connected repo) to avoid double deploys. Copy the Org ID + Project ID into the secrets above. The PWA build already reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from the committed `.env.production`, so no extra build env is needed.
3. **Push to `master`** — the workflow deploys both halves.

Client-side vars (`VITE_…`) stay exactly two entries in `.env.production`; anon key must remain public-safe (publishable format).

## Safety rails

DB PITR enabled on prod; migration applied to a staging clone before prod; service-worker cache-version bump verified on asset releases; rollback = PITR restore + redeploy prior function versions (drilled before Phase 2 exit).
