import { describe, it, expect } from 'vitest'
import {
  haversineMeters,
  GEO_TOLERANCE_METERS,
  geoEvidenceMismatch,
  formatDistanceMeters
} from '@/lib/verification'

describe('haversineMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineMeters(-1.2921, 36.7818, -1.2921, 36.7818)).toBeLessThan(1)
  })

  it('returns ~111 km per degree of latitude', () => {
    expect(haversineMeters(0, 36.78, 1, 36.78)).toBeCloseTo(111_195, -1)
  })

  it('is symmetric', () => {
    const forward = haversineMeters(-1.29, 36.78, -1.31, 36.81)
    const backward = haversineMeters(-1.31, 36.81, -1.29, 36.78)
    expect(forward).toBeCloseTo(backward, 3)
  })

  it('distinguishes a few hundred metres (block-level drift)', () => {
    expect(haversineMeters(-1.2921, 36.7818, -1.2935, 36.783)).toBeGreaterThan(200)
  })
})

describe('geoEvidenceMismatch', () => {
  it('returns null when either coordinate set is missing', () => {
    expect(geoEvidenceMismatch(null, null, -1.29, 36.78)).toBeNull()
    expect(geoEvidenceMismatch(-1.29, 36.78, null, null)).toBeNull()
    expect(geoEvidenceMismatch(-1.29, undefined, -1.29, 36.78)).toBeNull()
  })

  it('flags evidence beyond the tolerance', () => {
    const result = geoEvidenceMismatch(-1.2895, 36.765, -1.2921, 36.7818)
    expect(result?.flagged).toBe(true)
    expect(result?.toleranceMeters).toBe(GEO_TOLERANCE_METERS)
  })

  it('passes content captured within the tolerance', () => {
    const result = geoEvidenceMismatch(-1.2921, 36.7818, -1.2923, 36.7819)
    expect(result?.flagged).toBe(false)
    expect(result?.distanceMeters).toBeLessThan(100)
  })

  it('honours a custom tolerance', () => {
    const tight = geoEvidenceMismatch(-1.2921, 36.7818, -1.2923, 36.7819, 10)
    expect(tight?.flagged).toBe(true)
  })
})

describe('formatDistanceMeters', () => {
  it('renders metres under 1km', () => {
    expect(formatDistanceMeters(860)).toBe('860 m')
  })

  it('renders kilometres at and over 1km', () => {
    expect(formatDistanceMeters(1_890)).toBe('1.9 km')
  })
})