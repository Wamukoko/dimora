import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useRentLedger } from '@/hooks/useRentLedger'
import { formatLedgerPeriod, ledgerEntryStatus, summarizeLedger } from '@/lib/rentLedger'
import { formatKes } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { RentLedgerStatus } from '@/types/database'

const statusChip: Record<RentLedgerStatus, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  due: 'bg-red-50 text-red-700',
  overdue: 'bg-red-50 text-red-700'
}

export default function RentLedger() {
  usePageTitle('Rent ledger')
  const { profile } = useAuth()
  const { entries, loading, error } = useRentLedger(profile?.id)

  const summary = summarizeLedger(entries)

  return (
    <main className="mx-auto max-w-hunter px-4 pb-24 pt-6">
      <Link to="/profile" className="text-xs font-medium text-neutral-500 transition-colors hover:text-terracotta">
        ← Profile
      </Link>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Rent ledger</h1>
        {!loading && entries.length > 0 && (
          <span className="rounded-full bg-limewash px-2.5 py-1 text-xs tabular-nums text-ink">
            {entries.length} {entries.length === 1 ? 'period' : 'periods'}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-5 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/70" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-6 text-center shadow-card">
          <h2 className="font-display text-lg font-semibold">No ledger entries yet</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Once you move into a rented home, monthly dues and payments show up here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white p-3 shadow-card">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Balance due</p>
              <p className="mt-1 font-display text-sm font-bold text-ink sm:text-base">{formatKes(summary.balanceDue)}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-card">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Collected</p>
              <p className="mt-1 font-display text-sm font-bold text-verified sm:text-base">{formatKes(summary.collected)}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-card">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Paid on time</p>
              <p className="mt-1 font-display text-sm font-bold text-ink sm:text-base">
                {summary.paidPeriods}/{summary.totalPeriods}
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {entries.map((entry) => {
              const status = ledgerEntryStatus(entry)
              return (
                <li key={entry.id} className="rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-ink">{entry.propertyTitle}</h3>
                      <p className="mt-0.5 text-xs text-neutral-500">{formatLedgerPeriod(entry.periodStart, entry.periodEnd)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusChip[status]}`}>
                      {status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs">
                    <span className="text-neutral-500">
                      {formatKes(entry.amountPaid)} of {formatKes(entry.amountDue)}
                    </span>
                    {status === 'paid' ? (
                      <span className="font-medium text-verified">Fully paid</span>
                    ) : status === 'partial' ? (
                      <span className="font-medium text-amber-600">{formatKes(entry.amountDue - entry.amountPaid)} remaining</span>
                    ) : (
                      <span className="font-medium text-red-600">{formatKes(entry.amountDue)} due</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </main>
  )
}