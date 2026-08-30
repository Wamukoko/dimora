import { beforeEach, describe, expect, it } from 'vitest'
import { enqueueOfflineAction, getDB, getSyncQueue } from '@/lib/indexedDB'
import { processSyncQueue } from '@/lib/sync'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeClient(
  options: { bookingInsertError?: Error; propertyAvailable?: boolean } = {}
): SupabaseClient {
  const { bookingInsertError, propertyAvailable = true } = options

  const query: any = {
    maybeSingle: async () => {
      if (!propertyAvailable) return { data: null, error: null }
      return { data: { id: 'p_1' }, error: null }
    },
    single: async () => ({ data: { id: 'b_1' }, error: null }),
    insert: async () => {
      if (bookingInsertError) return { data: null, error: bookingInsertError }
      return { data: null, error: null }
    },
    select: () => query,
    eq: () => query
  }

  return {
    from: () => query
  } as unknown as SupabaseClient
}

async function resetQueue() {
  const db = await getDB()
  const tx = db.transaction('sync_queue', 'readwrite')
  await tx.objectStore('sync_queue').clear()
  await tx.done
}

beforeEach(async () => {
  await resetQueue()
})

describe('processSyncQueue', () => {
  it('is a no-op without a configured client (demo mode)', async () => {
    const result = await processSyncQueue(null)
    expect(result).toEqual({ synced: 0, deadLettered: 0 })
  })

  it('dispatches a successful booking request and clears it from the queue', async () => {
    await enqueueOfflineAction('BOOKING_REQUEST', { property_id: 'p_1' })
    const result = await processSyncQueue(makeClient())
    expect(result).toEqual({ synced: 1, deadLettered: 0 })
    expect(await getSyncQueue()).toHaveLength(0)
  })

  it('replays a failing item until the retry cap, then dead-letters it', async () => {
    await enqueueOfflineAction('BOOKING_REQUEST', { property_id: 'p_1' })
    const failingClient = makeClient({ bookingInsertError: new Error('network down') })

    let totalDeadLettered = 0
    for (let attempt = 0; attempt < 5; attempt++) {
      totalDeadLettered += (await processSyncQueue(failingClient)).deadLettered
    }

    expect(totalDeadLettered).toBe(1)
    expect(await getSyncQueue()).toHaveLength(0)
  })

  it('dead-letters a booking whose property vanished while offline', async () => {
    await enqueueOfflineAction('BOOKING_REQUEST', { property_id: 'p_gone' })
    const client = makeClient({ propertyAvailable: false })

    let totalDeadLettered = 0
    for (let attempt = 0; attempt < 5; attempt++) {
      totalDeadLettered += (await processSyncQueue(client)).deadLettered
    }

    expect(totalDeadLettered).toBe(1)
    expect(await getSyncQueue()).toHaveLength(0)
  })
})