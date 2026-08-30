import type { PropertyType } from '@/types/database'

export const PROPERTY_TYPES: PropertyType[] = [
  'apartment',
  'house',
  'bedsitter',
  'townhouse',
  'commercial',
  'land'
]

const paths: Record<PropertyType, React.ReactNode> = {
  apartment: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path strokeLinecap="round" d="M9 7.5h2.5M13.5 7.5h1.5M9 11h2.5M13.5 11h1.5M9 14.5h2.5M13.5 14.5h1.5M5 18h2M17 18h2" />
    </>
  ),
  house: (
    <>
      <path strokeLinejoin="round" d="M3 11 12 3.5 21 11" />
      <path strokeLinejoin="round" d="M5.5 9.5V20h13V9.5" />
      <path strokeLinecap="round" d="M10 20v-5h4v5" />
    </>
  ),
  bedsitter: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="1.5" />
      <path strokeLinecap="round" d="M7 16.5v-2M17 16.5v-2" />
      <rect x="7" y="9.5" width="10" height="5" rx="1" />
      <path strokeLinecap="round" d="M9 9.5v-1.5M15 9.5V8" />
    </>
  ),
  townhouse: (
    <>
      <path strokeLinejoin="round" d="M3.5 12 12 4l8.5 8" />
      <path strokeLinejoin="round" d="M6 10.5V20h12v-9.5" />
      <path strokeLinecap="round" d="M12 20v-4h2.5v4" />
      <path strokeLinecap="round" d="M9 13.5h1.5M14 13.5h1.5M9 16.5h1.5" />
    </>
  ),
  commercial: (
    <>
      <path strokeLinejoin="round" d="M4 20h16" />
      <path strokeLinecap="round" d="M5 20V5.5h14V20" />
      <path strokeLinejoin="round" d="M3.5 9.5 12 6l8.5 3.5" />
      <rect x="9.5" y="12" width="5" height="4" rx="0.8" />
      <path strokeLinecap="round" d="M7.5 15.5h1.5M15 15.5h1.5" />
    </>
  ),
  land: (
    <>
      <path strokeLinejoin="round" d="M12 20.5S5 14.3 5 9.8a7 7 0 0 1 14 0c0 4.5-7 10.7-7 10.7Z" />
      <circle cx="12" cy="9.8" r="2.5" />
    </>
  )
}

export function PropertyTypeIcon({ type, className = 'h-6 w-6' }: { type: PropertyType; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-hidden="true"
    >
      {paths[type]}
    </svg>
  )
}