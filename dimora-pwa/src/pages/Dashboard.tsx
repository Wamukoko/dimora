import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAgentDashboard } from '@/hooks/useAgentDashboard'
import { NewListingModal } from '@/components/agent/NewListingModal'

const STAGES = [
  { key: 'new_lead', label: 'New lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'viewing_booked', label: 'Viewing booked' },
  { key: 'closed', label: 'Closed' }
] as const

const DEPOSIT_KES = 200
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

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

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { loading, data, addListing, addLead } = useAgentDashboard()
  const [showNewListing, setShowNewListing] = useState(false)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const stats = useMemo(() => {
    const now = Date.now()
    const openLeads = data.items.filter((item) => item.stage !== 'closed').length
    const viewingsThisWeek = data.bookings.filter((booking) => {
      if (booking.status !== 'confirmed') return false
      const t = new Date(booking.scheduledAt).getTime()
      return t >= now - WEEK_MS && t <= now + WEEK_MS
    }).length
    const escrowCount = data.bookings.filter(
      (booking) => booking.status === 'confirmed' && !booking.hunterConfirmedViewing
    ).length
    return { openLeads, viewingsThisWeek, escrowCount }
  }, [data])

  const upcoming = useMemo(
    () =>
      data.bookings
        .filter((booking) => booking.status === 'confirmed')
        .slice(0, 4),
    [data]
  )

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <div className="mt-6 flex items-start justify-between gap-4 sm:mt-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-white/60">Here's your pipeline today.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewListing(true)}
          className="shrink-0 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-hover"
        >
          + Add listing
        </button>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Key stats">
        <StatCard label="Active listings" value={String(data.activeListings)} />
        <StatCard label="Open leads" value={String(stats.openLeads)} />
        <StatCard label="Viewings this week" value={String(stats.viewingsThisWeek)} />
        <StatCard label="Escrow pending" value={`KES ${(stats.escrowCount * DEPOSIT_KES).toLocaleString('en-KE')}`} />
      </section>

      <section className="mt-8" aria-label="Lead pipeline">
        <h2 className="font-display text-xl font-semibold text-white">Leads</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {STAGES.map((stage) => {
            const stageItems = data.items.filter((item) => item.stage === stage.key)
            return (
              <div key={stage.key} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
                    {stage.label}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums text-white/70">
                    {loading ? '–' : stageItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {loading &&
                    Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="animate-pulse rounded-xl bg-agent-light p-3">
                        <div className="h-3 w-3/4 rounded bg-white/20" />
                        <div className="mt-2 h-2.5 w-1/2 rounded bg-white/10" />
                      </div>
                    ))}
                  {!loading &&
                    stageItems.map((item) => (
                      <article key={item.id} className="rounded-xl bg-agent-light p-3">
                        <p className="truncate text-sm font-medium text-white">
                          {item.leadName ?? item.title}
                        </p>
                        <p className="truncate text-xs text-white/50">
                          {item.leadName ? item.title : item.leadPhone ?? item.leadSource}
                        </p>
                        {item.dueDate && (
                          <p className="mt-1.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                            {formatShortDate(item.dueDate)}
                          </p>
                        )}
                      </article>
                    ))}
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt('Lead name')
                      if (!name?.trim()) return
                      const phone = window.prompt('Phone number (optional)') ?? ''
                      void addLead(profile?.id ?? 'demo-agent', name.trim(), phone.trim())
                    }}
                    className="w-full rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs font-medium text-white/50 transition-colors hover:border-terracotta hover:text-white"
                  >
                    + Add lead
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-8" aria-label="Upcoming viewings">
        <h2 className="font-display text-xl font-semibold text-white">Upcoming viewings</h2>
        {loading ? (
          <div className="mt-4 space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white/5 p-5 text-sm text-white/60 ring-1 ring-white/10">
            No confirmed viewings yet. Share your listings — hunters book straight from the app.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
            {upcoming.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{booking.propertyTitle}</p>
                  <p className="text-xs text-white/50">{formatShortDate(booking.scheduledAt)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    booking.hunterConfirmedViewing
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {booking.hunterConfirmedViewing ? `KES ${DEPOSIT_KES} released` : `KES ${DEPOSIT_KES} held`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NewListingModal
        open={showNewListing}
        onClose={() => setShowNewListing(false)}
        onSubmit={(input, files) => addListing(profile?.id ?? 'demo-agent', input, files)}
      />
    </main>
  )
}
