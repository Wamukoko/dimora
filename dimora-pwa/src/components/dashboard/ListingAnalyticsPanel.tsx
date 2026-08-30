import { totalFromStats, useListingAnalytics } from '@/hooks/useListingAnalytics'

interface ListingAnalyticsPanelProps {
  agentId: string | undefined
}

export function ListingAnalyticsPanel({ agentId }: ListingAnalyticsPanelProps) {
  const { stats, loading } = useListingAnalytics(agentId)
  const totals = totalFromStats(stats)

  if (loading) {
    return <div className="h-20 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
  }

  const cells = [
    { label: 'Views', value: totals.views },
    { label: 'Saves', value: totals.favorites },
    { label: 'Bookings', value: totals.bookings },
    { label: 'WhatsApp leads', value: totals.whatsapp }
  ]

  return (
    <section aria-label="Listing performance" className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/60">Last 30 days</h2>
        <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
          {stats.filter((s) => s.isBoosted).length} boosted
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-xl bg-black/20 px-2 py-2 text-center">
            <p className="font-display text-lg font-bold tabular-nums text-white">{cell.value.toLocaleString()}</p>
            <p className="mt-0.5 truncate text-[10px] text-white/50">{cell.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}