import { Link } from 'react-router-dom'
import { useProperties } from '@/hooks/useProperties'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PropertyCard } from '@/components/property/PropertyCard'

export default function Home() {
  usePageTitle('Find verified homes')
  const { properties, loading, source } = useProperties(6)

  return (
    <main className="mx-auto max-w-hunter px-4 pb-24">
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-card">
        <p className="text-xs font-medium uppercase tracking-widest text-terracotta">Kenya's verified homes</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight">
          Find a home you can <span className="text-verified">trust</span>.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Every Dimora listing is checked on site — title deed, agent identity, and the property itself. Your
          viewing deposit stays protected until you've seen the home.
        </p>
        <Link
          to="/search"
          className="mt-5 flex items-center justify-between rounded-xl border border-line bg-limewash/40 px-4 py-3 text-sm text-neutral-500 transition-colors hover:border-terracotta"
        >
          Search apartments, houses, bedsitters…
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0 text-terracotta">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3.5-3.5" />
          </svg>
        </Link>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold tracking-tight">Latest listings</h2>
          <Link to="/search" className="text-xs font-medium text-terracotta hover:underline">
            View all
          </Link>
        </div>

        <div className="mt-4 grid gap-4">
          {loading ? (
            [0, 1].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-xl bg-white shadow-card">
                <div className="aspect-[4/3] bg-line/50" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-3/4 rounded bg-line/70" />
                  <div className="h-3 w-1/2 rounded bg-line/50" />
                  <div className="price h-4 w-1/3 rounded bg-line/60" />
                </div>
              </div>
            ))
          ) : properties.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
              <p className="text-sm font-medium text-ink">No listings yet</p>
              <p className="mt-1 text-xs text-neutral-500">
                Run the migration and seed script on your Supabase project to see homes here.
              </p>
            </div>
          ) : (
            <>
              {source === 'cache' && (
                <p className="rounded-xl bg-white/70 px-4 py-2.5 text-xs text-neutral-500">
                  Showing saved listings — reconnecting to refresh.
                </p>
              )}
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </>
          )}
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-line bg-white/60 p-6">
        <h2 className="font-display text-lg font-semibold">What "Verified" means</h2>
        <ul className="mt-3 space-y-3 text-sm text-neutral-700">
          {[
            ['Site visit', 'Our team physically inspected this property.'],
            ['Title deed', 'Ownership documents were reviewed and matched.'],
            ['Agent ID', 'The listing agent passed identity verification (KRA PIN / National ID).']
          ].map(([title, body]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-verified/15">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-verified">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0L3.3 9.5a1 1 0 0 1 1.4-1.4l3.9 3.9 6.7-6.7a1 1 0 0 1 1.4 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <span>
                <strong className="font-semibold">{title}.</strong> {body}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
