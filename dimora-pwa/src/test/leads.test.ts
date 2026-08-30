import { describe, it, expect } from 'vitest'
import { normalizePhone, isValidKenyanPhone, isValidEmail, findExistingLead } from '@/lib/leads'

describe('normalizePhone', () => {
  it('strips spaces, plus and dashes', () => {
    expect(normalizePhone('0712 345 678')).toBe('254712345678')
    expect(normalizePhone('+254 712-345-678')).toBe('254712345678')
  })

  it('prefixes bare 7xx numbers with 254', () => {
    expect(normalizePhone('712345678')).toBe('254712345678')
  })

  it('prefixes bare 1xx numbers with 254', () => {
    expect(normalizePhone('134567890')).toBe('254134567890')
  })

  it('leaves an already-intl number untouched', () => {
    expect(normalizePhone('254712345678')).toBe('254712345678')
  })

  it('returns empty for no digits', () => {
    expect(normalizePhone('abc')).toBe('')
  })
})

describe('isValidKenyanPhone', () => {
  it('accepts 0-prefixed Safaricom/Airtel numbers', () => {
    expect(isValidKenyanPhone('0712 345 678')).toBe(true)
    expect(isValidKenyanPhone('0101234567')).toBe(true)
  })

  it('accepts 254-prefixed numbers', () => {
    expect(isValidKenyanPhone('+254712345678')).toBe(true)
  })

  it('accepts bare 9-digit numbers', () => {
    expect(isValidKenyanPhone('712345678')).toBe(true)
  })

  it('rejects short, long, and non-Kenyan numbers', () => {
    expect(isValidKenyanPhone('071234')).toBe(false)
    expect(isValidKenyanPhone('071234567890')).toBe(false)
    expect(isValidKenyanPhone('254212345678')).toBe(false)
    expect(isValidKenyanPhone('')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts a plain email', () => {
    expect(isValidEmail('brian@example.com')).toBe(true)
  })

  it('accepts an empty value (email optional)', () => {
    expect(isValidEmail('')).toBe(true)
    expect(isValidEmail('   ')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isValidEmail('brian@')).toBe(false)
    expect(isValidEmail('brian example com')).toBe(false)
    expect(isValidEmail('@@example.com')).toBe(false)
  })
})

describe('findExistingLead', () => {
  const existing = [
    { leadPhone: '+254 722 000 111', email: 'wanjala@example.com' },
    { leadPhone: '0733000444', email: `` },
    { leadPhone: null, email: 'grace@example.com' }
  ]

  it('matches an existing lead by normalized phone', () => {
    const hit = findExistingLead(existing, '0722 000 111', 'someone-else@example.com')
    expect(hit).toBe(existing[0])
  })

  it('matches by email when phones differ', () => {
    const hit = findExistingLead(existing, '0799 888 777', 'GRACE@Example.com')
    expect(hit).toBe(existing[2])
  })

  it('returns null when nothing matches', () => {
    const hit = findExistingLead(existing, '0799 888 777', 'nobody@example.com')
    expect(hit).toBeNull()
  })
})