import { describe, expect, it } from 'vitest'
import { formatKes, formatPrice } from '@/lib/format'

describe('formatKes', () => {
  it('renders KES with thousands separators', () => {
    expect(formatKes(28000)).toBe('KES 28,000')
    expect(formatKes(9500)).toBe('KES 9,500')
  })

  it('handles zero', () => {
    expect(formatKes(0)).toBe('KES 0')
  })
})

describe('formatPrice', () => {
  it('uses English (Kenya) thousands grouping', () => {
    expect(formatPrice(1234567)).toBe('1,234,567')
  })
})