import type { ComparableProperty, Property } from '@/types/database'

export const COMPARABLE_PRICE_BAND = 0.2

export function findComparables(
  property: Pick<Property, 'id' | 'county' | 'price'>,
  candidates: ComparableProperty[],
  limit = 3
): ComparableProperty[] {
  const price = Number(property.price)
  const band = Math.max(price * COMPARABLE_PRICE_BAND, 1000)

  return candidates
    .filter((c) => c.id !== property.id)
    .filter((c) => c.county === property.county)
    .filter((c) => Math.abs(Number(c.price) - price) <= band)
    .sort((a, b) => Math.abs(Number(a.price) - price) - Math.abs(Number(b.price) - price))
    .slice(0, limit)
}