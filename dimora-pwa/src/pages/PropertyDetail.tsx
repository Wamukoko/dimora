import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { FormEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { enqueueOfflineAction, getCachedProperty } from '@/lib/indexedDB'
import { triggerBackgroundSync } from '@/lib/sync'
import { DEMO_AGENT, DEMO_PROPERTIES, DEMO_VERIFIED_KINDS } from '@/lib/demoData'
import type { Property, PublicProfile, VerificationKind } from '@/types/database'
import { verificationKindLabels } from '@/types/database'
import { VerifiedBadge } from '@/components/property/VerifiedBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useStkPush } from '@/hooks/useStkPush'

type BookingState = 'idle' | 'submitting' | 'pay' | 'awaiting_pin' | 'confirmed' | 'queued' | 'error'

interface PropertyReview {
  rating: number
  comment: string | null
  createdAt: string
  name: string
}

const DEMO_REVIEWS: Record<string, PropertyReview[]> = {
  'demo-kilimani': [
    {
      rating: 5,
      comment: 'Amina showed up exactly on time and the apartment matches every photo. Borehole water is a huge plus.',
      createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
      name: 'Brian O.'
    },
    {
      rating: 4,
      comment: 'Great light and secure parking. Slightly noisy on Ngong Road side during rush hour.',
      createdAt: new Date(Date.now() - 19 * 86400000).toISOString(),
      name: 'Faith K.'
    }
  ],
  'demo-milimani': [
    {
      rating: 5,
      comment: 'Spacious compound, genuine title deed shown on the spot. Worth the trip to Kisumu.',
      createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
      name: 'Otieno D.'
    }
  ]
}

function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      aria-label="Go back"
      className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition-colors hover:bg-white"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>()
  const { session, isAuthed } = useAuth()

  const [property, setProperty] = useState<Property | null>(null)
  const [agent, setAgent] = useState<PublicProfile | null>(null)
  const [verifiedKinds, setVerifiedKinds] = useState<VerificationKind[]>([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingState, setBookingState] = useState<BookingState>('idle')
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [payPhone, setPayPhone] = useState('')
  const { state: stkState, error: stkError, initiateStkPush } = useStkPush()

  const [isFavorite, setIsFavorite] = useState(false)
  const [reviews, setReviews] = useState<PropertyReview[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadReviews() {
      if (!property) return

      if (!supabase || fromCache || !property.agent_id) {
        setReviews(DEMO_REVIEWS[property.id] ?? [])
        return
      }

      const { data } = await supabase
        .from('reviews')
        .select('rating, comment, created_at, hunter_id')
        .eq('property_id', property.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (cancelled || !data) return

      const hunterIds = [...new Set(data.map((review) => review.hunter_id))]
      const names = new Map<string, string>()
      if (hunterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, full_name')
          .in('id', hunterIds)
        profiles?.forEach((p) => names.set(p.id, p.full_name ?? 'Hunter'))
      }

      if (!cancelled) {
        setReviews(
          data.map((review) => ({
            rating: review.rating,
            comment: review.comment,
            createdAt: review.created_at,
            name: names.get(review.hunter_id) ?? 'Hunter'
          }))
        )
      }
    }

    void loadReviews()
    return () => {
      cancelled = true
    }
  }, [property?.id, property?.agent_id, fromCache])

  useEffect(() => {
    let cancelled = false

    async function loadFavorite() {
      if (!supabase || !session?.user || !id) {
        setIsFavorite(false)
        return
      }
      const { data } = await supabase
        .from('favorites')
        .select('property_id')
        .eq('hunter_id', session.user.id)
        .eq('property_id', id)
        .maybeSingle()
      if (!cancelled) setIsFavorite(Boolean(data))
    }

    void loadFavorite()
    return () => {
      cancelled = true
    }
  }, [id, session?.user?.id])

  async function toggleFavorite() {
    if (!property) return
    const next = !isFavorite

    if (!supabase || !session?.user) {
      setIsFavorite(next)
      return
    }

    setIsFavorite(next)
    const userId = session.user.id
    const { error } = next
      ? await supabase.from('favorites').insert({ hunter_id: userId, property_id: property.id })
      : await supabase
          .from('favorites')
          .delete()
          .eq('hunter_id', userId)
          .eq('property_id', property.id)
    if (error) setIsFavorite(!next)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      if (!id) return

      if (!supabase) {
        const demo = DEMO_PROPERTIES.find((p) => p.id === id) ?? null
        if (demo) {
          setProperty(demo)
          setAgent(DEMO_AGENT)
          setVerifiedKinds(DEMO_VERIFIED_KINDS)
        }
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('properties')
        .select('id, agent_id, title, description, price, type, bedrooms, bathrooms, county, sub_county, neighborhood, images, is_published, is_verified')
        .eq('id', id)
        .single()

      if (cancelled) return

      if (!error && data) {
        setProperty(data as Property)
      } else {
        const cached = await getCachedProperty(id)
        if (cached) {
          setFromCache(true)
          setProperty({
            id: cached.id,
            agent_id: '',
            title: cached.title,
            description: null,
            price: cached.price,
            type: cached.type as Property['type'],
            bedrooms: cached.bedrooms,
            bathrooms: cached.bathrooms,
            county: cached.county,
            sub_county: cached.sub_county,
            neighborhood: cached.neighborhood,
            images: cached.images,
            is_published: true,
            is_verified: cached.is_verified
          })
        }
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function loadExtras() {
      if (!supabase || !property?.agent_id || property.agent_id === DEMO_AGENT.id) return

      const [{ data: agentData }, { data: kinds }] = await Promise.all([
        supabase.from('public_profiles').select('id, full_name, avatar_url, role').eq('id', property.agent_id).single(),
        supabase.from('public_property_verifications').select('kind').eq('property_id', property.id)
      ])

      if (cancelled) return
      if (agentData) setAgent(agentData as PublicProfile)
      if (kinds) setVerifiedKinds(kinds.map((k) => k.kind as VerificationKind))
    }
    void loadExtras()
    return () => {
      cancelled = true
    }
  }, [property?.id, property?.agent_id])

  async function handleBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!property) return

    const form = new FormData(event.currentTarget)
    const scheduledAt = form.get('scheduled_at') as string
    const notes = (form.get('notes') as string) || null
    if (!scheduledAt) return

    setBookingState('submitting')
    setBookingError(null)

    const payload = {
      property_id: property.id,
      hunter_id: session?.user.id ?? 'demo-hunter',
      agent_id: property.agent_id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      notes,
      idempotency_key: crypto.randomUUID()
    }

    try {
      if (!supabase || !navigator.onLine) throw new Error('offline')
      const { data, error } = await supabase
        .from('bookings')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error
      setBookingId(data.id)
      setBookingState('pay')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message === 'offline') {
        await enqueueOfflineAction('BOOKING_REQUEST', payload)
        void triggerBackgroundSync()
        setBookingState('queued')
      } else {
        setBookingError(message)
        setBookingState('error')
      }
    }
  }

  async function handlePayDeposit() {
    if (!bookingId || !payPhone.trim()) return
    if (!supabase) {
      setBookingError('M-PESA payments need a connected Supabase project (.env.local).')
      return
    }
    const result = await initiateStkPush({
      phoneNumber: payPhone,
      bookingId,
      purpose: 'viewing_deposit',
      accountReference: 'VIEWING'
    })
    if (!result.error) setBookingState('awaiting_pin')
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-hunter px-4 pb-28 pt-6">
        <div className="aspect-[16/10] animate-pulse rounded-2xl bg-line/50" />
        <div className="mt-5 h-6 w-3/4 animate-pulse rounded bg-line/50" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-line/40" />
      </main>
    )
  }

  if (!property) {
    return (
      <main className="mx-auto max-w-hunter px-4 pb-28 pt-10 text-center">
        <h1 className="font-display text-xl font-semibold">Listing not found</h1>
        <p className="mt-2 text-sm text-neutral-500">It may have been unpublished or removed.</p>
        <Link to="/search" className="mt-4 inline-block text-sm font-medium text-terracotta hover:underline">
          Back to search
        </Link>
      </main>
    )
  }

  const image = property.images?.[0]

  return (
    <>
      <main className="mx-auto max-w-hunter px-4 pb-32">
        <div className="relative">
          <BackButton />
          <div className="relative aspect-[16/11] overflow-hidden rounded-2xl bg-gradient-to-br from-limewash to-line/60">
            {image && (
              <img src={image} alt={property.title} className="h-full w-full object-cover" loading="eager" decoding="async" />
            )}
            <button
              type="button"
              onClick={() => void toggleFavorite()}
              aria-label={isFavorite ? 'Remove from saved homes' : 'Save this home'}
              aria-pressed={isFavorite}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform hover:scale-105"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-5 w-5 transition-colors ${isFavorite ? 'fill-terracotta stroke-terracotta' : 'fill-none stroke-neutral-600'}`}
                strokeWidth="1.8"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.5s-7.5-4.7-9.3-9A5.4 5.4 0 0 1 12 6.6a5.4 5.4 0 0 1 9.3 4.9c-1.8 4.3-9.3 9-9.3 9Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <header className="space-y-2">
            {property.is_verified && (
              <div className="flex items-center gap-2">
                <VerifiedBadge size="lg" />
                <div>
                  <p className="text-sm font-semibold text-verified">Dimora Verified</p>
                  {verifiedKinds.length > 0 && (
                    <p className="text-xs text-neutral-500">
                      {verifiedKinds.map((k) => verificationKindLabels[k]).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <h1 className="font-display text-2xl font-bold leading-snug tracking-tight">{property.title}</h1>

            <p className="flex items-center gap-1.5 text-sm text-neutral-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-terracotta">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {property.neighborhood}, {property.sub_county}, {property.county}
            </p>

            <p>
              <span className="price text-2xl">KES {property.price.toLocaleString('en-KE')}</span>
              <span className="ml-1 text-sm text-neutral-400">/month</span>
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-full border border-line px-3 py-1 text-xs font-medium capitalize text-neutral-600">{property.type}</span>
              <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-neutral-600">{property.bedrooms} bedroom{property.bedrooms === 1 ? '' : 's'}</span>
              <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-neutral-600">{property.bathrooms} bathroom{property.bathrooms === 1 ? '' : 's'}</span>
            </div>
          </header>

          {property.description && (
            <section aria-label="Description">
              <h2 className="font-display text-lg font-semibold">About this home</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700">{property.description}</p>
            </section>
          )}

          {agent && (
            <section aria-label="Listed by" className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-agent font-semibold text-white">
                  {(agent.full_name ?? '?')[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{agent.full_name ?? 'Dimora agent'}</p>
                  <p className="text-xs text-neutral-500">Listing agent</p>
                </div>
              </div>
            </section>
          )}

          {reviews.length > 0 && (
            <section aria-label="Reviews">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">What hunters say</h2>
                <span className="rounded-full bg-limewash px-2.5 py-1 text-xs font-semibold text-ink">
                  ★ {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
                  <span className="ml-1 font-normal text-neutral-500">· {reviews.length} review{reviews.length === 1 ? '' : 's'}</span>
                </span>
              </div>
              <ul className="mt-3 space-y-3">
                {reviews.map((review, index) => (
                  <li key={index} className="rounded-xl border border-line bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-agent text-xs font-semibold text-white">
                          {review.name[0]?.toUpperCase()}
                        </span>
                        <p className="text-sm font-medium">{review.name}</p>
                      </div>
                      <span className="text-sm text-amber-500" aria-label={`${review.rating} out of 5 stars`}>
                        {'★'.repeat(review.rating)}
                        <span className="text-neutral-300">{'★'.repeat(5 - review.rating)}</span>
                      </span>
                    </div>
                    {review.comment && (
                      <p className="mt-2 text-sm leading-relaxed text-neutral-700">{review.comment}</p>
                    )}
                    <p className="mt-1.5 text-[11px] text-neutral-400">
                      {new Date(review.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {fromCache && (
            <p className="rounded-xl bg-white/70 px-4 py-3 text-xs text-neutral-500">
              You're viewing a saved copy of this listing (shown while offline).
            </p>
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-hunter items-center justify-between gap-4">
          <div>
            <p className="price leading-tight">KES {property.price.toLocaleString('en-KE')}</p>
            <p className="text-[11px] text-neutral-400">per month</p>
          </div>
          <Button onClick={() => setBookingOpen(true)} disabled={!isAuthed}>
            {isAuthed ? 'Book viewing' : 'Sign in to book'}
          </Button>
        </div>
      </div>

      <Modal open={bookingOpen} onClose={() => setBookingOpen(false)} labelledBy="booking-title">
        <h2 id="booking-title" className="font-display text-lg font-semibold tracking-tight">
          {bookingState === 'pay' || bookingState === 'awaiting_pin' ? 'Secure your slot' : 'Book a viewing'}
        </h2>

        {bookingState === 'awaiting_pin' ? (
          <div className="mt-4 space-y-4" role="status">
            <div className="rounded-xl bg-verified/10 px-4 py-3 text-sm leading-relaxed text-verified">
              Check your phone — enter your M-PESA PIN on the prompt we just sent. Your viewing is confirmed
              the moment payment lands, and you'll get an SMS receipt.
            </div>
            <Button variant="secondary" size="lg" onClick={() => setBookingOpen(false)}>Done</Button>
          </div>
        ) : bookingState === 'pay' ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-verified/10 px-4 py-3 text-xs leading-relaxed text-verified">
              Viewing requested. Pay the KES 200 refundable deposit now to confirm your slot — it's released
              back to you after the visit.
            </div>

            <div>
              <label htmlFor="pay_phone" className="mb-1 block text-xs font-medium text-neutral-500">
                M-PESA phone number
              </label>
              <input
                id="pay_phone"
                type="tel"
                inputMode="tel"
                required
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                autoFocus
                className="w-full rounded-xl border border-line bg-limewash/40 px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-terracotta"
              />
            </div>

            {(stkError || bookingError) && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{stkError ?? bookingError}</p>
            )}

            <Button
              size="lg"
              disabled={stkState === 'sending' || payPhone.trim().length < 9}
              onClick={() => void handlePayDeposit()}
            >
              {stkState === 'sending' ? 'Sending prompt…' : 'Pay KES 200 via M-PESA'}
            </Button>

            <button
              type="button"
              onClick={() => setBookingOpen(false)}
              className="w-full text-center text-xs font-medium text-neutral-500 hover:text-ink"
            >
              I'll pay later — request the slot for now
            </button>
          </div>
        ) : bookingState === 'confirmed' ? (
          <div className="mt-4 space-y-4" role="status">
            <div className="rounded-xl bg-verified/10 px-4 py-3 text-sm text-verified">
              Viewing requested. The agent will confirm your slot shortly.
            </div>
            <Button variant="secondary" size="lg" onClick={() => setBookingOpen(false)}>Done</Button>
          </div>
        ) : bookingState === 'queued' ? (
          <div className="mt-4 space-y-4" role="status">
            <div className="rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta-hover">
              Saved offline — your booking will send automatically when you're back online.
            </div>
            <Button variant="secondary" size="lg" onClick={() => setBookingOpen(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleBook} className="mt-4 space-y-4">
            <div className="rounded-xl bg-verified/10 px-4 py-3 text-xs leading-relaxed text-verified">
              A KES 200 refundable deposit holds this slot. It's released back to you after the visit — agents never touch cash up front.
            </div>

            <div>
              <label htmlFor="scheduled_at" className="mb-1 block text-xs font-medium text-neutral-500">Preferred date &amp; time</label>
              <input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                required
                autoFocus
                min={new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16)}
                className="w-full rounded-xl border border-line bg-limewash/40 px-4 py-3 text-sm outline-none transition-colors focus:border-terracotta"
              />
            </div>

            <div>
              <label htmlFor="notes" className="mb-1 block text-xs font-medium text-neutral-500">Note to agent (optional)</label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="e.g. Coming with a friend, around 3pm"
                className="w-full resize-none rounded-xl border border-line bg-limewash/40 px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-terracotta"
              />
            </div>

            {bookingState === 'error' && bookingError && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{bookingError}</p>
            )}

            <Button type="submit" size="lg" disabled={bookingState === 'submitting'}>
              {bookingState === 'submitting' ? 'Requesting…' : 'Confirm booking'}
            </Button>
          </form>
        )}
      </Modal>
    </>
  )
}
