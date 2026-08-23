import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useEscrowRelease } from '@/hooks/useEscrowRelease'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { ReviewModal } from '@/components/review/ReviewModal'
import { usePageTitle } from '@/hooks/usePageTitle'

const roleChipStyles: Record<string, string> = {
  hunter: 'bg-white text-ink border border-line',
  agent: 'bg-agent text-white',
  admin: 'bg-terracotta text-white'
}

interface ViewingRow {
  id: string
  propertyId: string
  propertyTitle: string
  scheduledAt: string
  status: string
  hunterConfirmedViewing: boolean
  myRating?: number
}

const DEMO_VIEWINGS: ViewingRow[] = [
  {
    id: 'demo-booking-1',
    propertyId: 'demo-kilimani',
    propertyTitle: 'Sunlit 2-Bedroom in Kilimani',
    scheduledAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    status: 'confirmed',
    hunterConfirmedViewing: false
  },
  {
    id: 'demo-booking-2',
    propertyId: 'demo-milimani',
    propertyTitle: 'Modern 4-Bed Villa, Milimani Kisumu',
    scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'confirmed',
    hunterConfirmedViewing: false
  }
]

function formatViewingDate(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function UserProfile() {
  usePageTitle('Your profile')
  const { profile, signOut } = useAuth()
  const { releaseDeposit, busy, error: escrowError } = useEscrowRelease()
  const [viewings, setViewings] = useState<ViewingRow[]>([])
  const [viewingsLoading, setViewingsLoading] = useState(true)
  const [reviewTarget, setReviewTarget] = useState<ViewingRow | null>(null)
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [phoneBusy, setPhoneBusy] = useState(false)

  const displayedPhone = phoneOverride ?? profile?.phone_number ?? null

  async function savePhone() {
    if (!profile) return
    setPhoneBusy(true)
    if (supabase) {
      await supabase.from('profiles').update({ phone_number: phoneDraft.trim() }).eq('id', profile.id)
    }
    setPhoneOverride(phoneDraft.trim())
    setPhoneBusy(false)
    setEditingPhone(false)
  }

  useEffect(() => {
    let cancelled = false

    async function loadViewings() {
      if (!supabase || !profile) {
        setViewings(profile?.role === 'hunter' ? DEMO_VIEWINGS : [])
        setViewingsLoading(false)
        return
      }

      const { data } = await supabase
        .from('bookings')
        .select('id, property_id, scheduled_at, status, hunter_confirmed_viewing, properties(title)')
        .eq('hunter_id', profile.id)
        .order('scheduled_at', { ascending: true })
        .limit(10)

      if (cancelled) return
      const rows = data ?? []
      setViewings(
        rows.map((row) => ({
          id: row.id,
          propertyId: row.property_id,
          propertyTitle:
            (row.properties as { title?: string } | null)?.title ?? 'Property viewing',
          scheduledAt: row.scheduled_at,
          status: row.status,
          hunterConfirmedViewing: row.hunter_confirmed_viewing
        }))
      )
      setViewingsLoading(false)

      const bookingIds = rows.map((row) => row.id)
      if (bookingIds.length > 0) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('booking_id, rating')
          .in('booking_id', bookingIds)
        if (cancelled || !reviews) return
        setViewings((prev) =>
          prev.map((viewing) => {
            const hit = reviews.find((review) => review.booking_id === viewing.id)
            return hit ? { ...viewing, myRating: hit.rating } : viewing
          })
        )
      }
    }

    void loadViewings()
    return () => {
      cancelled = true
    }
  }, [profile])

  async function handleRelease(bookingId: string) {
    const ok = await releaseDeposit(bookingId)
    if (ok) {
      setViewings((rows) =>
        rows.map((row) => (row.id === bookingId ? { ...row, hunterConfirmedViewing: true } : row))
      )
    }
  }

  async function handleSubmitReview(rating: number, comment: string): Promise<boolean> {
    if (!reviewTarget) return false

    if (supabase && profile) {
      const { error } = await supabase.from('reviews').insert({
        booking_id: reviewTarget.id,
        property_id: reviewTarget.propertyId,
        hunter_id: profile.id,
        rating,
        comment: comment || null
      })
      if (error) return false
    }

    setViewings((rows) =>
      rows.map((row) => (row.id === reviewTarget.id ? { ...row, myRating: rating } : row))
    )
    return true
  }

  return (
    <main className="mx-auto max-w-hunter px-4 pb-24 pt-6">
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-terracotta font-display text-xl font-bold text-white">
            {profile ? (profile.full_name ?? profile.email)[0]?.toUpperCase() : '?'}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold tracking-tight">
              {profile?.full_name || 'Your profile'}
            </h1>
            <p className="truncate text-xs text-neutral-500">{profile?.email}</p>
          </div>
        </div>

        {profile && (
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">Role</dt>
              <dd>
                <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${roleChipStyles[profile.role]}`}>
                  {profile.role}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">Phone</dt>
              <dd className={displayedPhone ? '' : 'italic text-neutral-400'}>
                {editingPhone ? (
                  <span className="flex items-center gap-2">
                    <input
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      placeholder="+254 7XX XXX XXX"
                      inputMode="tel"
                      autoFocus
                      className="w-40 rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-terracotta focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={phoneBusy || !phoneDraft.trim()}
                      onClick={() => void savePhone()}
                      className="rounded-lg bg-terracotta px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {phoneBusy ? '…' : 'Save'}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneDraft(displayedPhone ?? '')
                      setEditingPhone(true)
                    }}
                    className="underline decoration-line underline-offset-4 transition-colors hover:text-terracotta"
                  >
                    {displayedPhone ?? 'Not set — add for M-PESA'} ✎
                  </button>
                )}
              </dd>
            </div>
          </dl>
        )}

        {profile?.role === 'admin' && (
          <Link
            to="/admin"
            className="mt-4 block rounded-xl border border-line px-4 py-3 text-sm font-medium text-ink transition-colors hover:border-terracotta"
          >
            Verification review console →
          </Link>
        )}

        <Button variant="secondary" size="lg" className="mt-8" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>

      {profile?.role === 'hunter' && (
        <section className="mt-6">
          <h2 className="px-1 font-display text-lg font-semibold tracking-tight">My viewings</h2>
          {viewingsLoading ? (
            <div className="mt-3 space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/70" />
              ))}
            </div>
          ) : viewings.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white p-5 text-sm text-neutral-500 shadow-card">
              No viewings booked yet. Find a home you love and book a visit — the KES 200 deposit
              protects the agent&apos;s time, and is returned to you if they don&apos;t show up.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {viewings.map((viewing) => {
                const canRelease =
                  viewing.status === 'confirmed' && !viewing.hunterConfirmedViewing
                return (
                  <article
                    key={viewing.id}
                    className="rounded-2xl bg-white p-4 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{viewing.propertyTitle}</h3>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {formatViewingDate(viewing.scheduledAt)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${
                          viewing.status === 'cancelled'
                            ? 'bg-red-50 text-red-700'
                            : viewing.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-limewash text-ink'
                        }`}
                      >
                        {viewing.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                      <span
                        className={`text-xs font-medium ${
                          viewing.hunterConfirmedViewing ? 'text-verified' : 'text-neutral-600'
                        }`}
                      >
                        {viewing.status !== 'confirmed'
                          ? 'No deposit held'
                          : viewing.hunterConfirmedViewing
                            ? 'KES 200 deposit released to agent'
                            : 'KES 200 deposit held in escrow'}
                      </span>

                      <div className="flex shrink-0 items-center gap-2">
                        {viewing.myRating ? (
                          <span className="rounded-full bg-limewash px-2.5 py-1 text-[11px] font-medium text-amber-600">
                            ★ {viewing.myRating} rated
                          </span>
                        ) : viewing.status === 'completed' && viewing.hunterConfirmedViewing ? (
                          <button
                            type="button"
                            onClick={() => setReviewTarget(viewing)}
                            className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-agent"
                          >
                            Rate viewing
                          </button>
                        ) : null}

                        {canRelease &&
                          (supabase ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleRelease(viewing.id)}
                              className="rounded-full bg-verified px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-verified/90 disabled:opacity-50"
                            >
                              {busy ? 'Releasing…' : 'Attended — release'}
                            </button>
                          ) : (
                            <span className="text-[11px] italic text-neutral-400">Demo data</span>
                          ))}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {escrowError && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
              {escrowError}
            </p>
          )}
        </section>
      )}

      <ReviewModal
        open={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        propertyTitle={reviewTarget?.propertyTitle ?? ''}
        onSubmit={handleSubmitReview}
      />
    </main>
  )
}
