import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, isValidEmail, isValidKenyanPhone, type LeadSource } from '@/lib/leads'
import type { AddLeadResult, LeadInput } from '@/hooks/useAgentDashboard'

interface AddLeadModalProps {
  open: boolean
  initialStage?: string
  onClose: () => void
  onSubmit: (input: LeadInput, force?: boolean) => Promise<AddLeadResult>
}

interface FormState {
  name: string
  phone: string
  email: string
  source: LeadSource
  context: string
  notes: string
  dueDate: string
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  email: '',
  source: 'manual',
  context: '',
  notes: '',
  dueDate: ''
}

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-neutral-400 focus:border-terracotta focus:outline-none'

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">
        {label} {optional && <span className="font-normal text-neutral-400">(optional)</span>}
      </span>
      {children}
    </label>
  )
}

export function AddLeadModal({ open, initialStage = 'new_lead', onClose, onSubmit }: AddLeadModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forceCreate, setForceCreate] = useState(false)

  const phoneState = form.phone.trim().length === 0 ? 'empty' : isValidKenyanPhone(form.phone) ? 'valid' : 'invalid'
  const emailInvalid = form.email.trim().length > 0 && !isValidEmail(form.email)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'phone' || key === 'email') setForceCreate(false)
  }

  function reset() {
    setForm(EMPTY_FORM)
    setBusy(false)
    setError(null)
    setForceCreate(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError('Lead name is required.')
      return
    }
    if (!isValidKenyanPhone(form.phone)) {
      setError('Enter a valid Kenyan phone number, e.g. 0712 345 678.')
      return
    }
    if (emailInvalid) {
      setError('That email address does not look right.')
      return
    }

    setBusy(true)
    const result = await onSubmit(
      {
        name: form.name.trim(),
        phone: form.phone,
        email: form.email.trim(),
        source: form.source,
        context: form.context.trim(),
        notes: form.notes.trim(),
        dueDate: form.dueDate,
        stage: initialStage
      },
      forceCreate
    )
    setBusy(false)

    if (result.ok) {
      reset()
      onClose()
    } else if (result.duplicate && !forceCreate) {
      setForceCreate(true)
    } else {
      setError(result.error ?? 'Could not save the lead. Try again.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="add-lead-title">
      <h2 id="add-lead-title" className="font-display text-lg font-semibold tracking-tight">
        Add a lead
      </h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Captured contacts land in your pipeline with the source tracked automatically.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Amina Wanjiru"
              required
            />
          </Field>
          <Field label="Phone *">
            <input
              className={`${inputClass} ${phoneState === 'invalid' ? 'border-red-300' : ''}`}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              inputMode="tel"
              placeholder="0712 345 678"
              required
            />
          </Field>
        </div>

        {phoneState === 'valid' && (
          <p className="-mt-2 text-[11px] text-emerald-600">✓ Valid number</p>
        )}
        {phoneState === 'invalid' && (
          <p className="-mt-2 text-[11px] text-red-600">Should be a 10-digit Kenyan number, e.g. 0712 345 678.</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" optional>
            <input
              className={`${inputClass} ${emailInvalid ? 'border-red-300' : ''}`}
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              type="email"
              inputMode="email"
              placeholder="amina@example.com"
            />
          </Field>
          <Field label="Source">
            <select
              className={inputClass}
              value={form.source}
              onChange={(e) => update('source', e.target.value as LeadSource)}
            >
              {LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {LEAD_SOURCE_LABELS[source]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Interested in" optional>
            <input
              className={inputClass}
              value={form.context}
              onChange={(e) => update('context', e.target.value)}
              placeholder="e.g. 2-Bed in Kilimani"
            />
          </Field>
          <Field label="Follow-up" optional>
            <input
              className={inputClass}
              value={form.dueDate}
              onChange={(e) => update('dueDate', e.target.value)}
              type="datetime-local"
            />
          </Field>
        </div>

        <Field label="Notes" optional>
          <textarea
            className={`${inputClass} min-h-[64px] resize-y`}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Budget up to 90K, needs parking, works late…"
          />
        </Field>

        {forceCreate && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
            A lead with this phone/email is already in your pipeline. Adding again creates a duplicate —
            confirm if that&apos;s intended.
          </p>
        )}

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
            {busy ? 'Saving…' : forceCreate ? 'Add duplicate anyway' : 'Add lead'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}