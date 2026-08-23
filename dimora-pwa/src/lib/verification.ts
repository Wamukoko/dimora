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
