import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { VERIFICATION_KINDS, geoEvidenceMismatch, type GeoMismatch, type VerificationKind } from '@/lib/verification'

export interface PendingVerification {
  id: string
  kind: VerificationKind
  evidenceUrl: string | null
  capturedAt: string | null
  latitude: number | null
  longitude: number | null
  hash: string | null
  propertyTitle: string
  agentName: string | null
  geoMismatch: GeoMismatch | null
}

const DEMO_PENDING: PendingVerification[] = [
  {
    id: 'demo-pv-1',
    kind: 'site_visit',
    evidenceUrl:
      'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800',
    capturedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    latitude: -1.2921,
    longitude: 36.7818,
    hash: '9f2c1a4e77b03d5c8a11',
    propertyTitle: 'Sunlit 2-Bedroom in Kilimani',
    agentName: 'Amina Wanjiru',
    geoMismatch: geoEvidenceMismatch(-1.2895, 36.765, -1.2921, 36.7818)
  },
  {
    id: 'demo-pv-2',
    kind: 'title_deed',
    evidenceUrl:
      'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800',
    capturedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    latitude: null,
    longitude: null,
    hash: '4b81de90cc25f7a2e634',
    propertyTitle: 'Modern 4-Bed Villa, Milimani Kisumu',
    agentName: 'Amina Wanjiru',
    geoMismatch: null
  },
  {
    id: 'demo-pv-3',
    kind: 'agent_id',
    evidenceUrl:
      'https://images.pexels.com/photos/210617/pexels-photo-210617.jpeg?auto=compress&cs=tinysrgb&w=800',
    capturedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    latitude: -1.2635,
    longitude: 36.803,
    hash: 'c07aa13b58d9e2104fa9',
    propertyTitle: 'Cozy 1-Bed in Kileleshwa',
    agentName: 'Amina Wanjiru',
    geoMismatch: null
  }
]

interface UseAdminVerificationsResult {
  rows: PendingVerification[]
  loading: boolean
  busyId: string | null
  error: string | null
  approve: (profileId: string, row: PendingVerification) => Promise<boolean>
  reject: (row: PendingVerification) => Promise<boolean>
}

export function useAdminVerifications(): UseAdminVerificationsResult {
  const [rows, setRows] = useState<PendingVerification[]>(DEMO_PENDING)
  const [loading, setLoading] = useState(() => Boolean(supabase))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('property_verifications')
        .select(
          `id,kind,evidence_url,evidence_captured_at,evidence_latitude,evidence_longitude,evidence_hash,
           properties(title, latitude, longitude, profiles(full_name))`
        )
        .is('verified_by', null)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (err) setError(err.message)
      setRows(
        (data ?? []).map((row) => {
          const property = row.properties as { title?: string; latitude?: number | null; longitude?: number | null; profiles?: { full_name?: string | null } | null } | null
          const geoMismatch =
            row.kind === 'site_visit'
              ? geoEvidenceMismatch(
                  property?.latitude ?? null,
                  property?.longitude ?? null,
                  row.evidence_latitude,
                  row.evidence_longitude
                )
              : null
          return {
            id: row.id,
            kind: row.kind as VerificationKind,
            evidenceUrl: row.evidence_url,
            capturedAt: row.evidence_captured_at,
            latitude: row.evidence_latitude,
            longitude: row.evidence_longitude,
            hash: row.evidence_hash ? String(row.evidence_hash).slice(0, 20) : null,
            propertyTitle: property?.title ?? 'Unknown property',
            agentName: property?.profiles?.full_name ?? null,
            geoMismatch
          }
        })
      )
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function approve(profileId: string, row: PendingVerification): Promise<boolean> {
    setError(null)
    setBusyId(row.id)

    try {
      if (supabase) {
        const { error: err } = await supabase
          .from('property_verifications')
          .update({ verified_by: profileId })
          .eq('id', row.id)
        if (err) throw new Error(err.message)
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      setRows((prev) => prev.filter((r) => r.id !== row.id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed.')
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function reject(row: PendingVerification): Promise<boolean> {
    setError(null)
    setBusyId(row.id)

    try {
      if (supabase) {
        const { error: err } = await supabase.from('property_verifications').delete().eq('id', row.id)
        if (err) throw new Error(err.message)
      } else {
        await new Promise((resolve) => setTimeout(resolve, 400))
      }

      setRows((prev) => prev.filter((r) => r.id !== row.id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed.')
      return false
    } finally {
      setBusyId(null)
    }
  }

  return { rows, loading, busyId, error, approve, reject }
}

export function kindLabel(kind: VerificationKind): string {
  return VERIFICATION_KINDS.find((entry) => entry.kind === kind)?.label ?? kind
}
