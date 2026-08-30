import { Link } from 'react-router-dom'
import { usePriceComparison } from '@/hooks/usePriceComparison'
import { formatKes } from '@/lib/format'
import type { Property } from '@/types/database'

export function PriceComparison({ property }: { property: Property }) {
  const { comparables, loading } = usePriceComparison(property)

  if (loading) return null
  if (comparables.length === 0) return null

  const min = Math.min(...comparables.map((c) => c.price))
  const max = Math.max(...comparables.map((c) => c.price))

  return (
    <section aria-label="Price comparison">
      <h2 className="font-display text-lg font-semibold">Similar homes nearby</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Published listings in {property.county} within 20% of this home&apos;s {formatKes(property.price)} —
        ranging from {formatKes(min)} to {formatKes(max)}.
      </p>
      <ul className="mt-3 space-y-2">
        {comparables.map((comparable) => (
          <li key={comparable.id}>
            <Link
              to={`/property/${comparable.id}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 transition-colors hover:border-terracotta"
            >
              {comparable.images[0] ? (
                <img
                  src={comparable.images[0]}
                  alt=""
                  loading="lazy"
                  className="h-12 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-limewash text-[9px] font-medium uppercase tracking-wide text-neutral-400">
                  No photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-ink">{comparable.title}</h3>
                <p className="truncate text-xs text-neutral-500">
                  {formatKes(comparable.price)}/month · {comparable.neighborhood} · {comparable.bedrooms}{' '}
                  bed{comparable.bedrooms === 1 ? '' : 's'}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  comparable.price <= property.price ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {comparable.price < property.price
                  ? `${Math.round((1 - comparable.price / property.price) * 100)}% cheaper`
                  : comparable.price === property.price
                    ? 'Same price'
                    : `${Math.round((comparable.price / property.price - 1) * 100)}% pricier`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}