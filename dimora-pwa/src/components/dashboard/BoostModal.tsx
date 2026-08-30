import { useState } from 'react'
import type { AgentListingRow } from '@/hooks/useAgentListings'
import { useStkPush } from '@/hooks/useStkPush'
import { BOOST_AMOUNT_KES, BOOST_DURATION_DAYS } from '@/lib/boost'

interface BoostModalProps {
  listing: AgentListingRow | null
  open: boolean
  onClose: () => void
  onActivate: (listing: AgentListingRow) => Promise<boolean>
}

type Phase = 'form' | 'sending' | 'sent'

export function BoostModal({ listing, open, onClose, onActivate }: BoostModalProps) {
  const [phase, setPhase] = useState<Phase>('form')
  const [phone, setPhone] = useState('')
  const { error, initiateStkPush } = useStkPush()

  if (!open || !listing) return null

  const handlePay = async () => {
    if (!phone.trim()) return
    setPhase('sending')
    const result = await initiateStkPush({
      phoneNumber: phone,
      purpose: 'listing_boost',
      accountReference: `BOOST-${listing.id}`.slice(0, 12)
    })
    if (result.error) {
      setPhase('form')
      return
    }
    await onActivate(listing)
    setPhase('sent')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="boost-title"
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-ink p-6 text-white sm:rounded-2xl"
      >
        {phase === 'sent' ? (
          <div className="space-y-4" role="status">
            <div className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm leading-relaxed text-emerald-300">
              Boost payment sent. {listing.title} is now boosted for {BOOST_DURATION_DAYS} days — it
              shows higher in search until the payment clears.
            </div>
            <button
              type="button"
              onClick={() => {
                setPhase('form')
                setPhone('')
                onClose()
              }}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/20"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 id="boost-title" className="font-display text-lg font-semibold tracking-tight">
              Boost {listing.title}
            </h2>
            <div className="rounded-xl bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/70 ring-1 ring-white/10">
              A one-off KES {BOOST_AMOUNT_KES} fee keeps this listing pinned to
              the top of search for {BOOST_DURATION_DAYS} days. Pay securely via M-PESA — the charge
              only applies once.
            </div>

            <div>
              <label htmlFor="boost_phone" className="mb-1 block text-xs font-medium text-white/60">
                M-PESA phone number
              </label>
              <input
                id="boost_phone"
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                disabled={phase === 'sending'}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-terracotta"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={phase === 'sending' || phone.trim().length < 9}
              onClick={() => void handlePay()}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-50 ${
                phase === 'sending' ? 'bg-terracotta/70' : 'bg-terracotta hover:bg-terracotta-hover'
              }`}
            >
              {phase === 'sending' ? 'Sending prompt…' : `Pay KES ${BOOST_AMOUNT_KES} via M-PESA`}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-xs font-medium text-white/50 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}