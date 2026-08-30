export const BOOST_AMOUNT_KES = 500
export const BOOST_DURATION_DAYS = 30

export function boostExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + BOOST_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
}