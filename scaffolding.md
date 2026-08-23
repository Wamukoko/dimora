# Dimora — Scaffolding & Module Boundaries

Four build contexts with one non-obvious constraint (service-worker code sharing). Dependency arrows point at what may be imported.

```
src/ (Vite React app)
  ├── lib/supabaseClient.ts      ← env vars only
  ├── lib/indexedDB.ts           ← imports offline-core (pure logic, no DOM/window)
  ├── hooks/, pages/, components/
src/service-worker.ts             ← SEPARATE build context; no window/document APIs
supabase/functions/*              ← Deno; never import from src/
supabase/migrations/*.sql         ← database-architect owned
```

## Rules

1. **SW sharing**: queue-processing logic lives in `src/lib/offline-core.ts` as pure functions over `idb` — imported by BOTH `useOfflineSync` and `service-worker.ts`. Never reference `window`, `navigator.onLine`, or React inside it. The SW bundle must inline this module (verify in vite config `rollupOptions`).
2. **Edge functions are self-contained**: each `supabase/functions/<name>/index.ts` imports only Deno std + esm.sh deps. Shared function helpers (CORS headers, JWT check) live in a local `_shared/` folder inside `supabase/functions/`.
3. **Types**: DB types generated via `supabase gen types typescript` into `src/types/database.generated.ts`; hand-written domain types extend, never duplicate.
4. **Tokens**: all design tokens in `tailwind.config.js`; components consume via utilities/classes only.

## Why scaffolded

The SW/app boundary and the functions/_shared pattern are where drift causes silent production bugs (stale SW logic vs app logic divergence). Everything else is standard Vite layout — don't add abstraction layers beyond this.
