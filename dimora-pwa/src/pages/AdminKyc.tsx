import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAdminKyc } from '@/hooks/useAdminKyc'

function maskPin(pin: string | null): string {
  if (!pin) return '—'
  return `${pin.slice(0, 4)}••••${pin.slice(-1)}`
}

export default function AdminKyc() {
  const { profile } = useAuth()
  const { rows, loading, busyId, error, approve, reject } = useAdminKyc()

  if (profile && profile.role !== 'admin') {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h1 className="font-display text-xl font-bold text-white">Not authorized</h1>
          <p className="mt-2 text-sm text-white/60">
            This console is for Dimora admins. Your account role is{' '}
            <span className="font-semibold text-white">{profile.role}</span>.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <Link to="/admin" className="text-xs font-medium text-white/60 transition-colors hover:text-white">
        ← Verification review
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">Agent KYC</h1>
        {!loading && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs tabular-nums text-white/70">
            {rows.length} pending
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-white/60">
        Approving an application checks the agent&apos;s IDs and elevates them to the agent role.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/15 p-3 text-xs font-medium text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-white/5 p-5 text-sm text-white/60 ring-1 ring-white/10">
          Queue is clear — no pending applications.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.agentId} className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-agent-light font-semibold text-white">
                    {row.agentName[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-white">{row.agentName}</h2>
                    <p className="truncate text-xs text-white/50">{row.agentEmail ?? 'No email on file'}</p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <dt>KRA PIN</dt>
                    <dd className="mt-0.5 font-mono text-white/80">{maskPin(row.kraPin)}</dd>
                  </div>
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <dt>Submitted</dt>
                    <dd className="mt-0.5 text-white/80">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-KE') : '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              {(row.idDocumentUrl || row.selfieUrl) && (
                <div className="grid grid-cols-2 gap-px bg-white/10">
                  {[row.idDocumentUrl, row.selfieUrl].map((url, index) =>
                    url ? (
                      <img key={index} src={url} alt={index === 0 ? 'ID document' : 'Selfie'} className="h-36 w-full object-cover" />
                    ) : (
                      <div key={index} className="flex h-36 items-center justify-center bg-agent-light text-xs text-white/40">
                        No image
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="flex gap-2 p-4">
                <button
                  type="button"
                  disabled={busyId === row.agentId}
                  onClick={() => void approve(profile?.id ?? 'demo-admin', row)}
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busyId === row.agentId ? 'Approving…' : 'Approve & elevate'}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.agentId}
                  onClick={() => void reject(profile?.id ?? 'demo-admin', row)}
                  className="flex-1 rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}