// Pure payment/escrow logic shared by edge functions.
// Framework-free on purpose: imported both by Deno edge functions and the
// frontend test suite (Vitest) so the escrow state machine is fully covered.

export type PaymentPurpose = 'viewing_deposit' | 'listing_boost' | 'subscription' | 'rent'

export type EscrowStatus = 'held' | 'released_to_agent' | 'refunded_to_hunter' | 'disputed'

export const DEPOSIT_AMOUNT = 200 // KES — flat viewing deposit held in escrow
export const BOOST_AMOUNT = 500 // KES — flat listing boost fee

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1)
  else if (cleaned.startsWith('7') || cleaned.startsWith('1')) cleaned = '254' + cleaned
  return cleaned
}

export function resolveAuthoritativeAmount(purpose: string): { amount: number } {
  if (purpose === 'viewing_deposit') return { amount: DEPOSIT_AMOUNT }
  if (purpose === 'listing_boost') return { amount: BOOST_AMOUNT }
  throw new Error(`Unsupported or not-yet-priced payment purpose: ${purpose}`)
}

// -- Escrow state machine ---------------------------------------------------
// 'held' is the only state a release/refund may leave. 'disputed' is terminal
// from the client's perspective and must NOT be bypassed via release/refund.

const ESCROW_RELEASABLE_FROM: ReadonlySet<string> = new Set(['held'])
const ESCROW_REFUNDABLE_FROM: ReadonlySet<string> = new Set(['held'])

export function canReleaseEscrow(current: string | null | undefined): boolean {
  return ESCROW_RELEASABLE_FROM.has(String(current))
}

export function canRefundEscrow(current: string | null | undefined): boolean {
  return ESCROW_REFUNDABLE_FROM.has(String(current))
}

// -- M-PESA callback parsing -------------------------------------------------
export interface ParsedCallback {
  checkoutRequestId: string
  resultCode: number
  resultDesc: string
  mpesaReceiptNumber: string | null
}

export function parseCallback(body: unknown): ParsedCallback | null {
  const stkCallback = (body as { Body?: { stkCallback?: unknown } })?.Body?.stkCallback
  if (!stkCallback) return null

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback as {
    CheckoutRequestID: string
    ResultCode: number
    ResultDesc: string
    CallbackMetadata?: { Item: Array<{ Name: string; Value: unknown }> }
  }

  let mpesaReceiptNumber: string | null = null
  if (ResultCode === 0 && CallbackMetadata?.Item) {
    const item = CallbackMetadata.Item.find((i) => i.Name === 'MpesaReceiptNumber')
    mpesaReceiptNumber = item?.Value != null ? String(item.Value) : null
  }

  return { checkoutRequestId: CheckoutRequestID, resultCode: ResultCode, resultDesc: ResultDesc, mpesaReceiptNumber }
}

// -- Idempotency keys ---------------------------------------------------------
export function buildIdempotencyKey(parts: Array<string | number | undefined | null>): string {
  return parts.map((part) => part ?? '').join(':')
}