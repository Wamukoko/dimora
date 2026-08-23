import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getPosition, hashFile, type VerificationKind } from '@/lib/verification'

export interface VerificationEntry {
  kind: VerificationKind
  evidenceUrl: string | null
  capturedAt: string | null
  approved: boolean
}

type Entries = Partial<Record<VerificationKind, VerificationEntry>>

interface UsePropertyVerificationsResult {
  entries: Entries
  loading: boolean
  submittingKind: VerificationKind | null
  error: string | null
  submitEvidence: (
    profileId: string,
    propertyId: string,
    kind: VerificationKind,
    file: File
  ) => Promise<boolean>
}

function entryFromRow(kind: VerificationKind, evidenceUrl: string | null, capturedAt: string | null): VerificationEntry {
  return { kind, evidenceUrl, capturedAt, approved: false }
}

export function usePropertyVerifications(propertyId?: string): UsePropertyVerificationsResult {
  const [entries, setEntries] = useState<Entries>({})
  const [loading, setLoading] = useState(() => Boolean(supabase))
  const [submittingKind, setSubmittingKind] = useState<VerificationKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }
      if (!propertyId) {
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('property_verifications')
        .select('kind,evidence_url,evidence_captured_at,verified_by')
        .eq('property_id', propertyId)

      if (cancelled) return
      if (err) setError(err.message)
      const next: Entries = {}
      for (const row of data ?? []) {
        next[row.kind as VerificationKind] = {
          kind: row.kind as VerificationKind,
          evidenceUrl: row.evidence_url,
          capturedAt: row.evidence_captured_at,
          approved: row.verified_by !== null
        }
      }
      setEntries(next)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [propertyId])

  async function submitEvidence(
    profileId: string,
    propertyId: string,
    kind: VerificationKind,
    file: File
  ): Promise<boolean> {
    setError(null)
    setSubmittingKind(kind)

    try {
      if (!supabase) {
        await new Promise((resolve) => setTimeout(resolve, 700))
        setEntries((prev) => ({
          ...prev,
          [kind]: entryFromRow(
            kind,
            'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E',
            new Date().toISOString()
          )
        }))
        return true
      }

      const [evidenceHash, position] = await Promise.all([hashFile(file), getPosition()])

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${profileId}/${propertyId}/verify-${kind}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw new Error(uploadError.message)

      const { data: publicUrl } = supabase.storage.from('property-images').getPublicUrl(path)
      if (!publicUrl?.publicUrl) throw new Error('Could not resolve upload URL')

      const { error: upsertError } = await supabase.from('property_verifications').upsert(
        {
          property_id: propertyId,
          kind,
          evidence_url: publicUrl.publicUrl,
          evidence_hash: evidenceHash,
          evidence_captured_at: new Date().toISOString(),
          ...(position ?? {})
        },
        { onConflict: 'property_id,kind' }
      )
      if (upsertError) throw new Error(upsertError.message)

      setEntries((prev) => ({
        ...prev,
        [kind]: entryFromRow(kind, publicUrl.publicUrl, new Date().toISOString())
      }))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed — try again.')
      return false
    } finally {
      setSubmittingKind(null)
    }
  }

  return { entries, loading, submittingKind, error, submitEvidence }
}
