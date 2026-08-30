import type { VerificationKind } from '@/types/database'

const paths: Record<VerificationKind, React.ReactNode> = {
  site_visit: (
    <>
      <path strokeLinejoin="round" d="M12 21s-6-4.7-6-10a6 6 0 0 1 12 0c0 5.3-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2" />
      <rect x="2.2" y="16" width="6.6" height="4.6" rx="1" transform="rotate(-18 5.5 18.3)" />
      <path strokeLinecap="round" d="M3.8 15.2 5 16.4" />
    </>
  ),
  title_deed: (
    <>
      <path strokeLinejoin="round" d="M7 3.5h7l3 3V20.5H7Z" />
      <path strokeLinecap="round" d="M14 3.5V6.8h3.2" />
      <path strokeLinecap="round" d="M10 10.5h4.5M10 13.5h4.5M10 16.5h2.5" />
      <circle cx="17.6" cy="17.6" r="4.2" />
      <path strokeLinecap="round" d="m20.5 20.5 2 2" />
      <path strokeLinecap="round" d="m17 18.5 1-1 .5 1.6 2.2.2-1.7 1.4.5 2.2-2-1.2-2 1.2.5-2.2-1.7-1.4 2.2-.2.5-1.6Z" />
    </>
  ),
  agent_id: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="9" cy="11" r="2.4" />
      <path strokeLinecap="round" d="M5.5 17c.6-2 2-2.8 3.5-2.8s2.9.8 3.5 2.8" />
      <path strokeLinecap="round" d="M14.5 9.5h4M14.5 12.5h4M14.5 15.5h2.5" />
    </>
  ),
  registry_crosscheck: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path strokeLinecap="round" d="m16 16 4.5 4.5" />
      <path strokeLinecap="round" d="M8.5 11h5M11 8.5v5" />
    </>
  )
}

export const TRUST_BADGE_KINDS: VerificationKind[] = [
  'site_visit',
  'title_deed',
  'agent_id',
  'registry_crosscheck'
]

export function TrustBadgeIcon({ kind, className = 'h-6 w-6' }: { kind: VerificationKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  )
}