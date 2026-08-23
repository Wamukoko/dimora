import { useEffect, useState } from 'react'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { getSyncQueue } from '@/lib/indexedDB'

export function ConnectivityBanner() {
  const { isOnline, isSyncing, deadLetteredCount, syncNow } = useOfflineSync()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      try {
        const queue = await getSyncQueue()
        if (!cancelled) setPendingCount(queue.length)
      } catch {
        /* storage unavailable */
      }
    }

    void refresh()
    const interval = window.setInterval(refresh, 15000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [isSyncing])

  if (isOnline && pendingCount === 0 && deadLetteredCount === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-hunter justify-center px-4"
      role="status"
      aria-live="polite"
    >
      {!isOnline ? (
        <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white shadow-card">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
          {pendingCount > 0
            ? `Offline — ${pendingCount} change${pendingCount === 1 ? '' : 's'} saved and will send automatically`
            : 'Offline — browsing from cache'}
        </div>
      ) : deadLetteredCount > 0 ? (
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-red-700 px-4 py-2 text-xs font-medium text-white shadow-card">
          <span>Some saved changes couldn&apos;t be sent</span>
          <button type="button" onClick={() => void syncNow()} className="underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-full bg-agent px-4 py-2 text-xs font-medium text-white shadow-card">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
          Sending saved changes…
        </div>
      )}
    </div>
  )
}
