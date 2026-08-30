import { useState } from 'react'
import type { FormEvent } from 'react'
import { useProperties } from '@/hooks/useProperties'
import { usePageTitle } from '@/hooks/usePageTitle'
import { filterProperties } from '@/lib/filter'
import { PropertyCard } from '@/components/property/PropertyCard'

const propertyTypes = ['apartment', 'house', 'bedsitter', 'townhouse', 'commercial', 'land'] as const

export default function Search() {
  usePageTitle('Search')
  const { properties, loading, source } = useProperties(50)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string | null>(null)

  const results = filterProperties(properties, query, type)

  function handleSearch(event: FormEvent) {
    event.preventDefault()
  }

  return (
    <main className="mx-auto max-w-hunter px-4 pb-24">
      <form onSubmit={handleSearch} className="sticky top-14 z-20 -mx-4 bg-limewash/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Neighborhood, county, or title…"
            aria-label="Search properties"
            className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-terracotta"
          />
          <button
            type="submit"
            className="rounded-xl bg-terracotta px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-hover"
          >
            Search
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by property type">
          {propertyTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType((cur) => (cur === t ? null : t))}
              aria-pressed={type === t}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                type === t
                  ? 'border-terracotta bg-terracotta text-white'
                  : 'border-line bg-white text-neutral-600 hover:border-terracotta'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </form>

      {loading ? (
        <div className="mt-6 grid gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl bg-white shadow-card">
              <div className="aspect-[4/3] bg-line/50" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-3/4 rounded bg-line/70" />
                <div className="h-3 w-1/2 rounded bg-line/50" />
                <div className="price h-4 w-1/3 rounded bg-line/60" />
              </div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">No homes match</p>
          <p className="mt-1 text-xs text-neutral-500">Try a different neighborhood or clear the type filter.</p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-neutral-500" role="status">
            {results.length} home{results.length === 1 ? '' : 's'} found
            {source === 'cache' ? ' (saved offline)' : ''}
          </p>
          <div className="mt-3 grid gap-4">
            {results.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
