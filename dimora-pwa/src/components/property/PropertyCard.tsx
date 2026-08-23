import { Link } from 'react-router-dom'
import type { Property } from '@/types/database'
import { VerifiedBadge } from '@/components/property/VerifiedBadge'

function formatPrice(price: number): string {
  return price.toLocaleString('en-KE')
}

export function PropertyCard({ property }: { property: Property }) {
  const image = property.images?.[0]

  return (
    <Link
      to={`/property/${property.id}`}
      className="block overflow-hidden rounded-xl bg-white shadow-card transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-limewash to-line/60">
        {image ? (
          <img
            src={image}
            alt={property.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-line">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="h-12 w-12">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />
            </svg>
          </div>
        )}
        {property.is_verified && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 p-0.5 shadow-sm backdrop-blur">
            <VerifiedBadge size="sm" />
          </span>
        )}
      </div>

      <div className="space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium capitalize text-neutral-600">
            {property.type}
          </span>
          <span className="text-[11px] text-neutral-500">{property.bedrooms} bed · {property.bathrooms} bath</span>
        </div>

        <h3 className="line-clamp-1 font-display text-base font-semibold tracking-tight">
          {property.title}
        </h3>

        <p className="text-xs text-neutral-500">
          {property.neighborhood} · {property.sub_county} · {property.county}
        </p>

        <p>
          <span className="price">KES {formatPrice(property.price)}</span>
          <span className="ml-1 text-xs text-neutral-400">/mo</span>
        </p>
      </div>
    </Link>
  )
}
