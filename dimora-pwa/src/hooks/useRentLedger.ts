import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { RentLedgerEntry } from '@/types/database'

const DEMO_LEDGER: RentLedgerEntry[] = [
  {
    id: 'demo-ledger-1',
    propertyId: 'demo-kilimani',
    propertyTitle: 'Sunlit 2-Bedroom in Kilimani',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    amountDue: 85000,
    amountPaid: 85000,
    status: 'paid',
    createdAt: '2026-06-01T08:00:00.000Z'
  },
  {
    id: 'demo-ledger-2',
    propertyId: 'demo-kilimani',
    propertyTitle: 'Sunlit 2-Bedroom in Kilimani',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    amountDue: 85000,
    amountPaid: 85000,
    status: 'paid',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'demo-ledger-3',
    propertyId: 'demo-kilimani',
    propertyTitle: 'Sunlit 2-Bedroom in Kilimani',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    amountDue: 85000,
    amountPaid: 40000,
    status: 'partial',
    createdAt: '2026-08-01T08:00:00.000Z'
  }
]

interface UseRentLedgerResult {
  entries: RentLedgerEntry[]
  loading: boolean
  error: string | null
}

export function useRentLedger(tenantId: string | undefined): UseRentLedgerResult {
  const [entries, setEntries] = useState<RentLedgerEntry[]>([])
  const [loading, setLoading] = useState(() => Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(Boolean(supabase))

    async function load() {
      if (!supabase || !tenantId) {
        setEntries(tenantId ? DEMO_LEDGER : [])
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('rent_ledger')
        .select('id, property_id, period_start, period_end, amount_due, amount_paid, status, created_at, properties(title)')
        .eq('tenant_id', tenantId)
        .order('period_start', { ascending: false })
        .limit(24)

      if (cancelled) return

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      setEntries(
        (data ?? []).map((row) => ({
          id: row.id,
          propertyId: row.property_id,
          propertyTitle: (row.properties as { title?: string } | null)?.title ?? 'Rental property',
          periodStart: row.period_start,
          periodEnd: row.period_end,
          amountDue: Number(row.amount_due),
          amountPaid: Number(row.amount_paid),
          status: (row.status as RentLedgerEntry['status']) ?? 'due',
          createdAt: row.created_at ?? ''
        }))
      )
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  return { entries, loading, error }
}