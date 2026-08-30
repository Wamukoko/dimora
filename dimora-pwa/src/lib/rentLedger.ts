import type { RentLedgerEntry, RentLedgerStatus } from '@/types/database'

export function ledgerEntryStatus(entry: Pick<RentLedgerEntry, 'amountDue' | 'amountPaid'>): RentLedgerStatus {
  if (entry.amountPaid >= entry.amountDue) return 'paid'
  if (entry.amountPaid > 0) return 'partial'
  return 'due'
}

export interface LedgerSummary {
  totalPeriods: number
  paidPeriods: number
  balanceDue: number
  collected: number
}

export function summarizeLedger(entries: RentLedgerEntry[]): LedgerSummary {
  return entries.reduce<LedgerSummary>(
    (summary, entry) => {
      const paid = ledgerEntryStatus(entry) === 'paid'
      return {
        totalPeriods: summary.totalPeriods + 1,
        paidPeriods: summary.paidPeriods + (paid ? 1 : 0),
        balanceDue: summary.balanceDue + Math.max(0, entry.amountDue - entry.amountPaid),
        collected: summary.collected + entry.amountPaid
      }
    },
    { totalPeriods: 0, paidPeriods: 0, balanceDue: 0, collected: 0 }
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

export function formatLedgerPeriod(periodStart: string, periodEnd: string): string {
  const start = parseYmd(periodStart)
  const end = parseYmd(periodEnd)
  if (!start || !end) return `${periodStart} – ${periodEnd}`
  const fmt = (p: { y: number; m: number; d: number }, includeYear: boolean) =>
    `${MONTHS[p.m - 1]} ${p.d}${includeYear ? `, ${p.y}` : ''}`
  if (start.y === end.y) return `${fmt(start, false)} – ${fmt(end, true)}`
  return `${fmt(start, true)} – ${fmt(end, true)}`
}