import { describe, it, expect } from 'vitest'
import { ledgerEntryStatus, summarizeLedger, formatLedgerPeriod } from '@/lib/rentLedger'
import type { RentLedgerEntry } from '@/types/database'

function entry(overrides: Partial<RentLedgerEntry>): RentLedgerEntry {
  return {
    id: 'e1',
    propertyId: 'p1',
    propertyTitle: 'Sunlit 2-Bedroom in Kilimani',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    amountDue: 85000,
    amountPaid: 0,
    status: 'due',
    createdAt: '2026-06-01T08:00:00.000Z',
    ...overrides
  }
}

describe('ledgerEntryStatus', () => {
  it('returns due when nothing has been paid', () => {
    expect(ledgerEntryStatus({ amountDue: 85000, amountPaid: 0 })).toBe('due')
  })

  it('returns partial for a partial payment', () => {
    expect(ledgerEntryStatus({ amountDue: 85000, amountPaid: 40000 })).toBe('partial')
  })

  it('returns paid at exactly the amount due', () => {
    expect(ledgerEntryStatus({ amountDue: 85000, amountPaid: 85000 })).toBe('paid')
  })

  it('returns paid when overpaid', () => {
    expect(ledgerEntryStatus({ amountDue: 85000, amountPaid: 90000 })).toBe('paid')
  })
})

describe('summarizeLedger', () => {
  it('sums totals across entries', () => {
    const summary = summarizeLedger([
      entry({ amountDue: 85000, amountPaid: 85000 }),
      entry({ id: 'e2', amountDue: 85000, amountPaid: 0 }),
      entry({ id: 'e3', amountDue: 16000, amountPaid: 16000 }),
      entry({ id: 'e4', amountDue: 16000, amountPaid: 8000 })
    ])
    expect(summary.totalPeriods).toBe(4)
    expect(summary.paidPeriods).toBe(2)
    expect(summary.balanceDue).toBe(93000)
    expect(summary.collected).toBe(109000)
  })

  it('is empty for an empty ledger', () => {
    expect(summarizeLedger([])).toEqual({ totalPeriods: 0, paidPeriods: 0, balanceDue: 0, collected: 0 })
  })
})

describe('formatLedgerPeriod', () => {
  it('formats a same-year month range', () => {
    expect(formatLedgerPeriod('2026-06-01', '2026-06-30')).toBe('Jun 1 – Jun 30, 2026')
  })

  it('includes the start year when spans years', () => {
    expect(formatLedgerPeriod('2026-11-01', '2027-11-30')).toBe('Nov 1, 2026 – Nov 30, 2027')
  })

  it('falls back to the raw strings for invalid dates', () => {
    expect(formatLedgerPeriod('not-a-date', '2026-06-30')).toBe('not-a-date – 2026-06-30')
  })
})