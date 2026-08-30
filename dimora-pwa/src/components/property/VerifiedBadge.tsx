import { useId } from 'react'

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg'
  title?: string
  className?: string
}

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-12 w-12'
}

export function VerifiedBadge({ size = 'sm', title = 'Dimora Verified — site visit, title deed and agent identity confirmed', className = '' }: VerifiedBadgeProps) {
  const arcId = useId()

  return (
    <svg
      viewBox="0 0 64 64"
      className={`${sizeClasses[size]} text-verified -rotate-6 shrink-0 ${className}`}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="2.5 3.5" strokeLinecap="round" opacity="0.85" />
      <circle cx="32" cy="32" r="23.5" fill="currentColor" opacity="0.08" />
      <circle cx="32" cy="32" r="23.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <defs>
        <path id={arcId} d="M14 32a18 18 0 0 1 36 0" fill="none" />
      </defs>
      <text fontSize="5" letterSpacing="1" fill="currentColor" opacity="0.9">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          DIMORA VERIFIED
        </textPath>
      </text>
      <path d="M22.5 33.5 29 40l13-13.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}