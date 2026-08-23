import { supabase } from '@/lib/supabaseClient'
import {
  getSyncQueue,
  clearQueueItem,
  incrementRetryOrDeadLetter,
  type OfflineAction
} from '@/lib/indexedDB'

export const SYNC_TAG = 'dimora-sync-queue'

export interface SyncResult {
  synced: number
  deadLettered: number
}

async function dispatchAction(supabaseClient: NonNullable<typeof supabase>, item: OfflineAction): Promise<void> {
  switch (item.type) {
    case 'BOOKING_REQUEST': {
      const { property_id } = item.payload as { property_id?: string }
      if (!property_id) throw new Error('Booking payload missing property_id')

      const { data: property } = await supabaseClient
        .from('properties')
        .select('id')
        .eq('id', property_id)
        .eq('is_published', true)
        .maybeSingle()
      if (!property) throw new Error('Property is no longer available')

      const { error } = await supabaseClient.from('bookings').insert(item.payload)
      if (error) throw new Error(error.message)
      return
    }
    case 'TOGGLE_FAVORITE':
      return
    default:
      throw new Error(`Unknown offline action type`)
  }
}

export async function processSyncQueue(): Promise<SyncResult> {
  if (!supabase) return { synced: 0, deadLettered: 0 }

  const queue = await getSyncQueue()
  let synced = 0
  let deadLettered = 0

  for (const item of queue) {
    if (item.id === undefined) continue
    try {
      await dispatchAction(supabase, item)
      await clearQueueItem(item.id)
      synced++
    } catch {
      const outcome = await incrementRetryOrDeadLetter(item.id)
      if (outcome === 'dead-lettered') deadLettered++
    }
  }

  return { synced, deadLettered }
}

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register(tag: string): Promise<void> }
}

export async function triggerBackgroundSync(): Promise<void> {
  try {
    const registration = (await navigator.serviceWorker.ready) as SyncCapableRegistration
    if (registration.sync) {
      await registration.sync.register(SYNC_TAG)
    }
  } catch {
    /* Background Sync unsupported (iOS Safari); the in-page online listener covers it */
  }
}
