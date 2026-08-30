import { describe, it, expect } from 'vitest'
import { findComparables } from '@/lib/comparables'
import type { ComparableProperty } from '@/types/database'

const candidates: ComparableProperty[] = [
  { id: 'a', title: 'Kilimani 1-bed', price: 70000, type: 'apartment', neighborhood: 'Kilimani', county: 'Nairobi', bedrooms: 1, images: [] },
  { id: 'b', title: 'Kilimani 2-bed', price: 88000, type: 'apartment', neighborhood: 'Kilimani', county: 'Nairobi', bedrooms: 2, images: [] },
  { id: 'c', title: 'Mombasa beach pad', price: 82000, type: 'apartment', neighborhood: 'Nyali', county: 'Mombasa', bedrooms: 2, images: [] },
  { id: 'd', title: 'Kilimani luxury', price: 140000, type: 'apartment', neighborhood: 'Kilimani', county: 'Nairobi', bedrooms: 2, images: [] },
  { id: 'same', title: 'Same listing', price: 85000, type: 'apartment', neighborhood: 'Kilimani', county: 'Nairobi', bedrooms: 2, images: [] }
]

describe('findComparables', () => {
  const property = { id: 'same', county: 'Nairobi', price: 85000 }

  it('excludes the listing itself', () => {
    const result = findComparables(property, candidates)
    expect(result.some((c) => c.id === 'same')).toBe(false)
  })

  it('only includes listings in the same county', () => {
    const result = findComparables(property, candidates)
    expect(result.every((c) => c.county === 'Nairobi')).toBe(true)
  })

  it('only includes listings within the 20% price band', () => {
    const result = findComparables(property, candidates)
    expect(result.find((c) => c.id === 'd')).toBeUndefined()
    expect(result.map((c) => c.id)).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('sorts by price proximity to the current listing', () => {
    const result = findComparables(property, candidates)
    expect(result[0].id).toBe('b')
    expect(result[1].id).toBe('a')
  })

  it('caps the number of returned comparisons', () => {
    const many: ComparableProperty[] = [
      { id: 'x1', title: '1', price: 84000, type: 'apartment', neighborhood: 'N', county: 'Nairobi', bedrooms: 2, images: [] },
      { id: 'x2', title: '2', price: 86000, type: 'apartment', neighborhood: 'N', county: 'Nairobi', bedrooms: 2, images: [] },
      { id: 'x3', title: '3', price: 83000, type: 'apartment', neighborhood: 'N', county: 'Nairobi', bedrooms: 2, images: [] },
      { id: 'x4', title: '4', price: 87000, type: 'apartment', neighborhood: 'N', county: 'Nairobi', bedrooms: 2, images: [] }
    ]
    expect(findComparables(property, many, 3)).toHaveLength(3)
  })
})