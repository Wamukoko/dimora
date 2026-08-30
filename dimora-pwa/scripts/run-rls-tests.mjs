// RLS regression runner for Project Dimora.
//
// Reads supabase/tests/rls_regression.sql, splits on the `---- SCENARIO:`
// banner, and executes each chunk as a single simple-query statement against
// Supabase-local Postgres (default 127.0.0.1:54322). Every chunk is an
// explicit, self-contained transaction that rolls itself back, so no test
// data ever persists. A chunk FAILS when Postgres raises any exception
// (assertions inside the chunk raise exceptions starting with ASSERT_FAIL:).
//
// Usage:
//   node scripts/run-rls-tests.mjs
//   PG_CONNECTION_STRING=postgresql://postgres:postgres@localhost:54322/postgres node scripts/run-rls-tests.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const { Client } = pg

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const sqlPath = join(root, 'supabase', 'tests', 'rls_regression.sql')
const banner = /^-- ---- SCENARIO:/m

function chunksFrom(source) {
  const markers = []
  let match
  const re = new RegExp(banner.source, 'gm')
  while ((match = re.exec(source)) !== null) markers.push(match.index)

  const chunks = []
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i]
    const end = markers[i + 1] ?? source.length
    const body = source.slice(start, end).trim()
    const header = body.split('\n', 1)[0]
    const name = header.replace(/^-- ---- SCENARIO:\s*/, '').trim()
    if (body) chunks.push({ name, body })
  }
  return chunks
}

const source = readFileSync(sqlPath, 'utf8')
const scenarios = chunksFrom(source)
if (scenarios.length === 0) {
  console.error('No scenarios found in', sqlPath)
  process.exit(1)
}

const connectionString =
  process.env.PG_CONNECTION_STRING ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const client = new Client({ connectionString })
await client.connect()

const results = []
for (const scenario of scenarios) {
  const label = `RLS ${scenario.name}`
  process.stdout.write(`  ${label} ... `)
  try {
    await client.query(scenario.body)
    results.push({ name: scenario.name, pass: true })
    console.log('PASS')
  } catch (err) {
    const message = err instanceof Error ? err.message.split('\n')[0] : String(err)
    results.push({ name: scenario.name, pass: false, message })
    console.log('FAIL')
  }
}

await client.end()

const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} RLS regression scenarios passed`)
if (passed === results.length) {
  console.log('All RLS regression scenarios passed.')
} else {
  for (const r of results.filter((r) => !r.pass)) {
    console.error(`- ${r.name}: ${r.message}`)
  }
  process.exitCode = 1
}