import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router-dom'
import { kindLabel, useAdminVerifications } from '@/hooks/useAdminVerifications'
import { formatDistanceMeters } from '@/lib/verification'

export default function AdminReview() {
  const { profile } = useAuth()
  const { rows, loading, busyId, error, approve, reject } = useAdminVerifications()

  if (profile && profile.role !== 'admin') {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h1 className="font-display text-xl font-bold text-white">Not authorized</h1>
          <p className="mt-2 text-sm text-white/60">
            This review console is for Dimora admins. Your account role is{' '}
            <span className="font-semibold text-white">{profile.role}</span>.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Verification review
        </h1>
        <div className="flex items-center gap-2">
          {!loading && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs tabular-nums text-white/70">
              {rows.length} pending
            </span>
          )}
          <Link to="/admin/kyc" className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70 transition-colors hover:bg-white/20 hover:text-white">
            KYC queue →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-white/60">
        Approving the three required kinds for a listing flips its Verified badge automatically.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/15 p-3 text-xs font-medium text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-white/5 p-5 text-sm text-white/60 ring-1 ring-white/10">
          Queue is clear — no pending submissions.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
              {row.evidenceUrl ? (
                <img src={row.evidenceUrl} alt={`${kindLabel(row.kind)} evidence`} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center bg-agent-light text-xs text-white/40">
                  No image attached
                </div>
              )}

              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white">{kindLabel(row.kind)}</h2>
                  {row.hash && (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
                      sha256:{row.hash}…
                    </span>
                  )}
                </div>

                <dl className="space-y-1 text-xs text-white/60">
                  <div className="flex justify-between gap-3">
                    <dt>Property</dt>
                    <dd className="truncate font-medium text-white/80">{row.propertyTitle}</dd>
                  </div>
                  {row.agentName && (
                    <div className="flex justify-between gap-3">
                      <dt>Agent</dt>
                      <dd className="text-white/80">{row.agentName}</dd>
                    </div>
                  )}
                  {row.capturedAt && (
                    <div className="flex justify-between gap-3">
                      <dt>Captured</dt>
                      <dd className="text-white/80">
                        {new Date(row.capturedAt).toLocaleString('en-KE')}
                      </dd>
                    </div>
                  )}
                  {row.latitude !== null && row.longitude !== null && (
                    <div className="flex justify-between gap-3">
                      <dt>GPS</dt>
                      <dd className="tabular-nums text-white/80">
                        {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                      </dd>
                    </div>
                  )}
                  {row.geoMismatch?.flagged && (
                    <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-300">
                      GPS drift — evidence captured ~
                      {formatDistanceMeters(row.geoMismatch.distanceMeters)} from the listed
                      location.
                    </p>
                  )}
                </dl>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void approve(profile?.id ?? 'demo-admin', row)}
                    className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busyId === row.id ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void reject(row)}
                    className="flex-1 rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
