import { describe, it, expect } from 'vitest'
import { BOOST_AMOUNT_KES, BOOST_DURATION_DAYS, boostExpiresAt } from '@/lib/boost'

describe('boost pricing', () => {
  it('is a flat KES 500 fee', () => {
    expect(BOOST_AMOUNT_KES).toBe(500)
  })

  it('lasts 30 days', () => {
    expect(BOOST_DURATION_DAYS).toBe(30)
  })
})

describe('boostExpiresAt', () => {
  it('is exactly 30 days from the given date', () => {
    const start = new Date('2026-08-01T10:00:00.000Z')
    expect(boostExpiresAt(start)).toBe(new Date('2026-08-31T10:00:00.000Z').toISOString())
  })

  it('defaults to now when no date is passed', () => {
    const before = new Date()
    const expires = boostExpiresAt()
    const after = new Date()
    const expected = new Date(before.getTime() + BOOST_DURATION_DAYS * 24 * 60 * 60 * 1000).getTime()
    expect(new Date(expires).getTime()).toBeGreaterThanOrEqual(expected)
    expect(new Date(expires).getTime()).toBeLessThanOrEqual(
      new Date(after.getTime() + BOOST_DURATION_DAYS * 24 * 60 * 60 * 1000).getTime()
    )
  })
})