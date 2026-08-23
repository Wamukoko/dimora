import { useAuth } from '@/hooks/useAuth'

const stages = ['New lead', 'Contacted', 'Viewing booked', 'Closed'] as const

const placeholderCounts: Record<(typeof stages)[number], number> = {
  'New lead': 3,
  Contacted: 2,
  'Viewing booked': 1,
  Closed: 4
}

interface StatCardProps {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <p className="text-xs font-medium text-white/60">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {greeting}, {firstName}.
      </h1>
      <p className="mt-1 text-sm text-white/60">Here's your pipeline today.</p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Key stats">
        <StatCard label="Active listings" value="4" />
        <StatCard label="Open leads" value="6" />
        <StatCard label="Viewings this week" value="2" />
        <StatCard label="Escrow pending" value="KES 400" />
      </section>

      <section className="mt-8" aria-label="Lead pipeline">
        <h2 className="font-display text-xl font-semibold text-white">Leads</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {stages.map((stage) => (
            <div key={stage} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/70">{stage}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums text-white/70">
                  {placeholderCounts[stage]}
                </span>
              </div>
              <div className="space-y-2">
                {Array.from({ length: Math.min(placeholderCounts[stage], 2) }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-agent-light p-3">
                    <div className="h-3 w-3/4 rounded bg-white/20" />
                    <div className="mt-2 h-2.5 w-1/2 rounded bg-white/10" />
                  </div>
                ))}
                <button
                  type="button"
                  className="w-full rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs font-medium text-white/50 transition-colors hover:border-terracotta hover:text-white"
                >
                  + Add lead
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
