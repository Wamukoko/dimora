import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAgentListings } from '@/hooks/useAgentListings'
import { VerifiedBadge } from '@/components/property/VerifiedBadge'
import { ListingAnalyticsPanel } from '@/components/dashboard/ListingAnalyticsPanel'
import { BoostModal } from '@/components/dashboard/BoostModal'
import { supabase } from '@/lib/supabaseClient'
import { boostExpiresAt } from '@/lib/boost'

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

export default function AgentListings() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { rows, loading, error, togglePublished } = useAgentListings(profile?.id)
  const [boostTarget, setBoostTarget] = useState<string | null>(null)
  const [boosted, setBoosted] = useState<Set<string>>(new Set())

  async function handleBoost(listing: (typeof rows)[number]): Promise<boolean> {
    if (supabase && profile) {
      const { error: err } = await supabase
        .from('properties')
        .update({ is_boosted: true, boost_expires_at: boostExpiresAt() })
        .eq('id', listing.id)
        .eq('agent_id', profile.id)
      if (err) return false
    }
    setBoosted((prev) => new Set(prev).add(listing.id))
    return true
  }

  const boostListing = rows.find((row) => row.id === boostTarget) ?? null

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <Link to="/dashboard" className="text-xs font-medium text-white/60 transition-colors hover:text-white">
        ← Dashboard
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">My listings</h1>
        {!loading && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs tabular-nums text-white/70">
            {rows.length}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/15 p-3 text-xs font-medium text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5">
        <ListingAnalyticsPanel agentId={profile?.id} />
      </div>

      {loading ? (
        <div className="mt-5 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-white/5 p-5 text-sm text-white/60 ring-1 ring-white/10">
          No listings yet. Head back to the dashboard and tap “+ Add listing” to publish your first
          property.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              {row.images[0] ? (
                <img
                  src={row.images[0]}
                  alt=""
                  loading="lazy"
                  className="h-14 w-20 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-agent-light text-[10px] font-medium uppercase tracking-wide text-white/30">
                  No photo
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-white">{row.title}</h2>
                  {row.isVerified && <VerifiedBadge size="sm" />}
                  {boosted.has(row.id) && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      ◉ Boosted
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-white/50">
                  {formatKes(row.price)} · {row.neighborhood}, {row.county}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => void togglePublished(row)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    row.isPublished
                      ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {row.isPublished ? 'Live' : 'Paused'}
                </button>
                <button
                  type="button"
                  onClick={() => setBoostTarget(row.id)}
                  className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/25"
                >
                  Boost ◉
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/listings/${row.id}/verify`)}
                  className="text-[10px] font-medium text-white/50 underline underline-offset-2 transition-colors hover:text-white"
                >
                  Verifications →
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hi! Are you still interested in ${row.title} (${formatKes(row.price)}/month, ${row.neighborhood})? I can arrange a viewing — Amina via Dimora. ${window.location.origin}/property/${row.id}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-medium text-emerald-300/80 underline underline-offset-2 transition-colors hover:text-emerald-200"
                >
                  WhatsApp lead →
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BoostModal
        listing={boostListing}
        open={boostListing !== null}
        onClose={() => setBoostTarget(null)}
        onActivate={handleBoost}
      />
    </main>
  )
}
