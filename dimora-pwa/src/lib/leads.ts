export const LEAD_SOURCES = ['whatsapp', 'search', 'referral', 'walk_in', 'marketplace', 'manual'] as const

export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp: 'WhatsApp',
  search: 'Search on Dimora',
  referral: 'Referral',
  walk_in: 'Walk-in',
  marketplace: 'Marketplace ad',
  manual: 'Manual entry'
}

// Kenyan phone handling: strips punctuation, normalizes to international 254 format.
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('7') || digits.startsWith('1')) return `254${digits}`
  return digits
}

// Accepts 07XX XXX XXX, 2547XX XXX XXX, or a bare 7XX/1XX with 9 digits.
export function isValidKenyanPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('0')) return /^0[17]\d{8}$/.test(digits)
  if (digits.startsWith('254')) return /^254[17]\d{8}$/.test(digits)
  return /^[17]\d{8}$/.test(digits)
}

export function isValidEmail(input: string): boolean {
  const value = input.trim()
  return value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

interface LeadCandidate {
  leadPhone: string | null
  email?: string | null
}

// Matches an existing lead by normalized phone or, when both sides provide one, by email.
export function findExistingLead<T extends LeadCandidate>(existing: T[], phone: string, email?: string): T | null {
  const targetPhone = normalizePhone(phone)
  const targetEmail = email?.trim().toLowerCase()

  if (targetPhone) {
    const byPhone = existing.find((lead) => lead.leadPhone && normalizePhone(lead.leadPhone) === targetPhone)
    if (byPhone) return byPhone
  }

  if (targetEmail) {
    return (
      existing.find((lead) => lead.email && lead.email.trim().toLowerCase() === targetEmail) ??
      null
    )
  }

  return null
}