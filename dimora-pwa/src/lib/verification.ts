export const VERIFICATION_KINDS = [
  {
    kind: 'site_visit',
    label: 'Site visit',
    description: 'Photos or a short walkthrough recorded at the property.'
  },
  {
    kind: 'title_deed',
    label: 'Title deed',
    description: 'Clear photo of the title deed or lease certificate.'
  },
  {
    kind: 'agent_id',
    label: 'Agent identity',
    description: 'Your national ID or passport — name and photo visible.'
  },
  {
    kind: 'registry_crosscheck',
    label: 'Registry cross-check',
    description: 'Search result from Ardhi Sasa or the lands registry (optional, speeds up approval).'
  }
] as const

export type VerificationKind = (typeof VERIFICATION_KINDS)[number]['kind']

export const REQUIRED_KINDS: VerificationKind[] = ['site_visit', 'title_deed', 'agent_id']

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusMeters = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const GEO_TOLERANCE_METERS = 200

export interface GeoMismatch {
  flagged: boolean
  distanceMeters: number
  toleranceMeters: number
}

export function geoEvidenceMismatch(
  listingLat: number | null | undefined,
  listingLng: number | null | undefined,
  evidenceLat: number | null | undefined,
  evidenceLng: number | null | undefined,
  toleranceMeters = GEO_TOLERANCE_METERS
): GeoMismatch | null {
  if (
    listingLat == null ||
    listingLng == null ||
    evidenceLat == null ||
    evidenceLng == null
  ) {
    return null
  }
  const distanceMeters = haversineMeters(listingLat, listingLng, evidenceLat, evidenceLng)
  return { flagged: distanceMeters > toleranceMeters, distanceMeters, toleranceMeters }
}

export function formatDistanceMeters(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function getPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60_000 }
    )
  })
}
