import { describe, expect, it } from 'vitest'
import {
  DEPOSIT_AMOUNT,
  BOOST_AMOUNT,
  formatPhoneNumber,
  resolveAuthoritativeAmount,
  parseCallback,
  canReleaseEscrow,
  canRefundEscrow,
  buildIdempotencyKey
} from '../../supabase/functions/_shared/payments.ts'

describe('formatPhoneNumber', () => {
  it('strips non-digits', () => {
    expect(formatPhoneNumber('+254 712 345 678')).toBe('254712345678')
  })

  it('converts a leading 0 to the 254 prefix', () => {
    expect(formatPhoneNumber('0712345678')).toBe('254712345678')
  })

  it('prefixes bare 7xx/1xx numbers', () => {
    expect(formatPhoneNumber('712345678')).toBe('254712345678')
    expect(formatPhoneNumber('112345678')).toBe('254112345678')
  })

  it('leaves an already-international number untouched', () => {
    expect(formatPhoneNumber('254712345678')).toBe('254712345678')
  })
})

describe('resolveAuthoritativeAmount', () => {
  it('prices a viewing deposit from server policy', () => {
    expect(resolveAuthoritativeAmount('viewing_deposit').amount).toBe(DEPOSIT_AMOUNT)
  })

  it('prices a listing boost from server policy', () => {
    expect(resolveAuthoritativeAmount('listing_boost').amount).toBe(BOOST_AMOUNT)
  })

  it('rejects purposes that have no pricing yet', () => {
    expect(() => resolveAuthoritativeAmount('rent')).toThrow()
    expect(() => resolveAuthoritativeAmount('subscription')).toThrow()
  })

  it('rejects an unknown purpose', () => {
    expect(() => resolveAuthoritativeAmount('gift_hamper')).toThrow()
  })
})

describe('parseCallback', () => {
  it('returns null for a non-STK payload', () => {
    expect(parseCallback({ foo: 'bar' })).toBeNull()
  })

  it('parses a successful callback with receipt', () => {
    const parsed = parseCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'ws_CO_123',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'MpesaReceiptNumber', Value: 'SFX9K1A2B3' },
              { Name: 'TransactionDate', Value: 20260101090000 }
            ]
          }
        }
      }
    })
    expect(parsed).toEqual({
      checkoutRequestId: 'ws_CO_123',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      mpesaReceiptNumber: 'SFX9K1A2B3'
    })
  })

  it('parses a failed callback with no receipt', () => {
    const parsed = parseCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'ws_CO_456',
          ResultCode: 1032,
          ResultDesc: 'The service request is cancelled.',
          CallbackMetadata: undefined
        }
      }
    })
    expect(parsed).toEqual({
      checkoutRequestId: 'ws_CO_456',
      resultCode: 1032,
      resultDesc: 'The service request is cancelled.',
      mpesaReceiptNumber: null
    })
  })
})

describe('escrow state machine', () => {
  it('only releases from held', () => {
    expect(canReleaseEscrow('held')).toBe(true)
    expect(canReleaseEscrow('released_to_agent')).toBe(false)
    expect(canReleaseEscrow('refunded_to_hunter')).toBe(false)
    expect(canReleaseEscrow('disputed')).toBe(false)
    expect(canReleaseEscrow(null)).toBe(false)
  })

  it('only refunds from held', () => {
    expect(canRefundEscrow('held')).toBe(true)
    expect(canRefundEscrow('released_to_agent')).toBe(false)
    expect(canRefundEscrow('refunded_to_hunter')).toBe(false)
    expect(canRefundEscrow('disputed')).toBe(false)
  })
})

describe('buildIdempotencyKey', () => {
  it('joins parts with colons', () => {
    expect(buildIdempotencyKey(['booking', 'b_1', 'retry'])).toBe('booking:b_1:retry')
  })

  it('treats nullish parts as empty strings', () => {
    expect(buildIdempotencyKey(['booking', undefined, 3])).toBe('booking::3')
  })
})