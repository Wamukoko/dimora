import { useCallback, useEffect, useState } from 'react'
import { processSyncQueue } from '@/lib/sync'

interface OfflineSyncState {
  isOnline: boolean
  isSyncing: boolean
  deadLetteredCount: number
  syncNow: () => Promise<void>
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [deadLetteredCount, setDeadLetteredCount] = useState(0)

  const syncNow = useCallback(async () => {
    setIsSyncing(true)
    try {
      const result = await processSyncQueue()
      if (result.deadLettered > 0) {
        setDeadLetteredCount((count) => count + result.deadLettered)
      }
    } finally {
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true)
      void syncNow()
    }
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    if (navigator.onLine) void syncNow()

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [syncNow])

  return { isOnline, isSyncing, deadLetteredCount, syncNow }
}
