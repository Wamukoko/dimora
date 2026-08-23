import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface ReviewModalProps {
  open: boolean
  onClose: () => void
  propertyTitle: string
  onSubmit: (rating: number, comment: string) => Promise<boolean>
}

const starButton = (active: boolean) =>
  `text-2xl leading-none transition-colors ${active ? 'text-amber-500' : 'text-neutral-300 hover:text-amber-300'}`

export function ReviewModal({ open, onClose, propertyTitle, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (rating < 1) return
    setError(null)
    setBusy(true)
    const ok = await onSubmit(rating, comment.trim())
    setBusy(false)
    if (ok) {
      setRating(0)
      setComment('')
      onClose()
    } else {
      setError('Could not save your review. Try again.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="review-title">
      <h2 id="review-title" className="font-display text-lg font-semibold tracking-tight">
        How was the viewing?
      </h2>
      <p className="mt-0.5 truncate text-xs text-neutral-500">{propertyTitle}</p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
        <div className="flex justify-center gap-1.5 py-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
              onClick={() => setRating(value)}
              className={starButton(value <= rating)}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional — anything other hunters should know?"
          className="min-h-[72px] w-full resize-y rounded-xl border border-line px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:border-terracotta focus:outline-none"
        />

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || rating < 1} className="flex-1">
            {busy ? 'Saving…' : rating < 1 ? 'Pick a rating' : 'Submit review'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
