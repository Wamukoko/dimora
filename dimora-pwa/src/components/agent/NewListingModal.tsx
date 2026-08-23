import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { NewListingInput } from '@/hooks/useAgentDashboard'

const PROPERTY_TYPES = ['apartment', 'house', 'bedsitter', 'townhouse', 'commercial', 'land'] as const

interface NewListingModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: NewListingInput) => Promise<boolean>
}

interface FormState {
  title: string
  price: string
  type: (typeof PROPERTY_TYPES)[number]
  county: string
  sub_county: string
  neighborhood: string
  bedrooms: string
  bathrooms: string
  description: string
  imagesText: string
}

const EMPTY_FORM: FormState = {
  title: '',
  price: '',
  type: 'apartment',
  county: '',
  sub_county: '',
  neighborhood: '',
  bedrooms: '2',
  bathrooms: '1',
  description: '',
  imagesText: ''
}

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-neutral-400 focus:border-terracotta focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
    </label>
  )
}

export function NewListingModal({ open, onClose, onSubmit }: NewListingModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const price = Number(form.price)
    if (!form.title.trim() || !form.county.trim()) {
      setError('Title and county are required.')
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a valid price in KES.')
      return
    }

    setBusy(true)
    const ok = await onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      price,
      type: form.type,
      county: form.county.trim(),
      sub_county: form.sub_county.trim(),
      neighborhood: form.neighborhood.trim(),
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      images: form.imagesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    })
    setBusy(false)

    if (ok) {
      setForm(EMPTY_FORM)
      onClose()
    } else {
      setError('Could not save the listing. Try again.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="new-listing-title">
      <h2 id="new-listing-title" className="font-display text-lg font-semibold tracking-tight">
        Add a listing
      </h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Goes live instantly. Verification badges are added after Dimora&apos;s checks.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
        <Field label="Title *">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Sunlit 2-Bedroom in Kilimani"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rent / price (KES) *">
            <input
              className={inputClass}
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
              inputMode="numeric"
              placeholder="65000"
              required
            />
          </Field>
          <Field label="Type">
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => update('type', e.target.value as FormState['type'])}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="County *">
            <input
              className={inputClass}
              value={form.county}
              onChange={(e) => update('county', e.target.value)}
              placeholder="Nairobi"
              required
            />
          </Field>
          <Field label="Sub-county">
            <input
              className={inputClass}
              value={form.sub_county}
              onChange={(e) => update('sub_county', e.target.value)}
              placeholder="Dagoretti North"
            />
          </Field>
          <Field label="Neighbourhood">
            <input
              className={inputClass}
              value={form.neighborhood}
              onChange={(e) => update('neighborhood', e.target.value)}
              placeholder="Kilimani"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedrooms">
            <input
              className={inputClass}
              value={form.bedrooms}
              onChange={(e) => update('bedrooms', e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Bathrooms">
            <input
              className={inputClass}
              value={form.bathrooms}
              onChange={(e) => update('bathrooms', e.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className={`${inputClass} min-h-[72px] resize-y`}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Light-filled rooms, borehole water, walking distance to Yaya Centre…"
          />
        </Field>

        <Field label="Image URLs (one per line)">
          <textarea
            className={`${inputClass} min-h-[56px] resize-y font-mono text-xs`}
            value={form.imagesText}
            onChange={(e) => update('imagesText', e.target.value)}
            placeholder="https://images.pexels.com/..."
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? 'Publishing…' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
