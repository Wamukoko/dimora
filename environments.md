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

`MPESA_CONSUMER_KEY/SECRET/PASSKEY/SHORTCODE`, `MPESA_ENVIRONMENT`, `MPESA_CALLBACK_SECRET`, `WHATSAPP_BUSINESS_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `SMS_GATEWAY_API_KEY/USERNAME`.

Rules: distinct `MPESA_CALLBACK_SECRET` per environment · rotation quarterly + on any suspected exposure · secrets never in client bundle or logs.

## Deploy flow

PR → CI gates (typecheck, suites, Lighthouse budgets) → merge → staging auto-deploy (migrations via `supabase db push`, then `functions deploy`) → manual promotion to production (protected environment, two-person rule for money-path changes).

## Safety rails

DB PITR enabled on prod; migration applied to a staging clone before prod; service-worker cache-version bump verified on asset releases; rollback = PITR restore + redeploy prior function versions (drilled before Phase 2 exit).
