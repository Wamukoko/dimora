import { describe, expect, it } from 'vitest'
import { filterProperties } from '@/lib/filter'
import type { Property } from '@/types/database'

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'p_1',
    title: 'Sunny 2BR Apartment',
    price: 28000,
    county: 'Nairobi',
    sub_county: 'Westlands',
    neighborhood: 'Kilimani',
    type: 'apartment',
    bedrooms: 2,
    bathrooms: 1,
    images: [],
    description: '',
    is_verified: false,
    is_published: true,
    agent_id: 'a_1',
    ...overrides
  }
}

const properties = [
  makeProperty(),
  makeProperty({ id: 'p_2', title: 'Cozy Bedsitter', neighborhood: 'South B', type: 'bedsitter', price: 9500 }),
  makeProperty({ id: 'p_3', title: 'Family House', neighborhood: 'Lavington', type: 'house', county: 'Kiambu' })
]

describe('filterProperties', () => {
  it('returns everything when query is empty and type is null', () => {
    expect(filterProperties(properties, '', null)).toHaveLength(3)
  })

  it('filters on title, case-insensitively', () => {
    expect(filterProperties(properties, 'bedsitter', null).map((p) => p.id)).toEqual(['p_2'])
  })

  it('matches neighborhood and county keywords too', () => {
    expect(filterProperties(properties, 'kilimani', null).map((p) => p.id)).toEqual(['p_1'])
    expect(filterProperties(properties, 'kiambu', null).map((p) => p.id)).toEqual(['p_3'])
  })

  it('combines a property-type filter with the text query', () => {
    expect(filterProperties(properties, 'South B', 'bedsitter').map((p) => p.id)).toEqual(['p_2'])
    expect(filterProperties(properties, 'grin', 'bedsitter')).toEqual([])
  })

  it('is exclusive on type: an apartment query hides non-apartments', () => {
    expect(filterProperties(properties, '', 'apartment').map((p) => p.id)).toEqual(['p_1'])
  })

  it('treats whitespace queries as empty', () => {
    expect(filterProperties(properties, '   ', null)).toHaveLength(3)
  })
})