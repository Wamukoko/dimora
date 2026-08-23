import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePropertyVerifications } from '@/hooks/usePropertyVerifications'
import { REQUIRED_KINDS, VERIFICATION_KINDS } from '@/lib/verification'
import type { VerificationKind } from '@/lib/verification'
import { supabase } from '@/lib/supabaseClient'
import { DEMO_PROPERTIES } from '@/lib/demoData'

const kindChipStyles: Record<'approved' | 'pending' | 'missing', string> = {
  approved: 'bg-emerald-500/15 text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-300',
  missing: 'bg-white/10 text-white/50'
}

export default function VerifyListing() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { entries, loading, submittingKind, error, submitEvidence } = usePropertyVerifications(id)
  const [listingTitle, setListingTitle] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTitle() {
      if (!id) return
      if (!supabase) {
        setListingTitle(DEMO_PROPERTIES.find((p) => p.id === id)?.title ?? null)
        return
      }
      const { data } = await supabase.from('properties').select('title').eq('id', id).maybeSingle()
      if (!cancelled) setListingTitle(data?.title ?? null)
    }

    void loadTitle()
    return () => {
      cancelled = true
    }
  }, [id])

  const approvedCount = REQUIRED_KINDS.filter((kind) => entries[kind]?.approved).length
  const submittedCount = REQUIRED_KINDS.filter((kind) => entries[kind]).length

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <Link to="/dashboard/listings" className="text-xs font-medium text-white/60 transition-colors hover:text-white">
        ← My listings
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Verifications
      </h1>
      <p className="mt-1 truncate text-sm text-white/60">{listingTitle ?? 'Loading listing…'}</p>

      <div className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <p className="text-xs leading-relaxed text-white/60">
          Upload genuine evidence for each check. Dimora&apos;s team reviews submissions — once the
          three required checks are approved, your listing earns the{' '}
          <span className="font-semibold text-emerald-300">Verified</span> stamp and ranks higher in
          search.
        </p>
        {!loading && (
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-white/40">
            Required checks approved: {approvedCount}/3 · Submitted: {submittedCount}/3
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/15 p-3 text-xs font-medium text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {VERIFICATION_KINDS.map(({ kind, label, description }) => {
          const entry = entries[kind]
          const state: 'approved' | 'pending' | 'missing' = entry?.approved
            ? 'approved'
            : entry
              ? 'pending'
              : 'missing'
          const busy = submittingKind === kind

          return (
            <article key={kind} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">{label}</h2>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${kindChipStyles[state]}`}>
                  {state === 'approved' ? 'Approved' : state === 'pending' ? 'In review' : 'Required'}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{description}</p>

              {entry?.evidenceUrl && (
                <img
                  src={entry.evidenceUrl}
                  alt={`${label} evidence`}
                  className="mt-3 h-28 w-full rounded-xl object-cover"
                />
              )}
              {entry?.capturedAt && (
                <p className="mt-2 text-[11px] text-white/40">
                  Captured {new Date(entry.capturedAt).toLocaleString('en-KE')}
                </p>
              )}

              <label
                className={`mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-medium transition-colors ${
                  busy
                    ? 'pointer-events-none border-white/10 text-white/30'
                    : 'border-white/20 text-white/70 hover:border-terracotta hover:text-white'
                }`}
              >
                {busy ? 'Uploading & hashing…' : entry ? 'Replace evidence' : 'Upload evidence'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={busy || loading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file && id && profile?.id) {
                      void submitEvidence(profile.id, id, kind as VerificationKind, file)
                    }
                  }}
                />
              </label>
            </article>
          )
        })}
      </div>
    </main>
  )
}
