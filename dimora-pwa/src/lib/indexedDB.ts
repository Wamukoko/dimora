import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface PropertyCache {
  id: string
  title: string
  price: number
  county: string
  sub_county: string
  neighborhood: string
  images: string[]
  type: string
  bedrooms: number
  bathrooms: number
  is_verified: boolean
  cachedAt: number
}

export interface OfflineAction {
  id?: number
  type: 'BOOKING_REQUEST' | 'TOGGLE_FAVORITE'
  payload: Record<string, any>
  timestamp: number
  retryCount: number
}

interface DimoraDB extends DBSchema {
  cached_properties: {
    key: string
    value: PropertyCache
    indexes: { 'by-cachedAt': number }
  }
  sync_queue: {
    key: number
    value: OfflineAction
  }
}

const DB_NAME = 'dimora-offline-db'
const DB_VERSION = 1
const MAX_CACHED_PROPERTIES = 50
const MAX_RETRY_COUNT = 5

export async function getDB(): Promise<IDBPDatabase<DimoraDB>> {
  return openDB<DimoraDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cached_properties')) {
        const propStore = db.createObjectStore('cached_properties', { keyPath: 'id' })
        propStore.createIndex('by-cachedAt', 'cachedAt')
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

export async function cacheProperty(property: Omit<PropertyCache, 'cachedAt'>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('cached_properties', 'readwrite')
  const store = tx.objectStore('cached_properties')

  await store.put({ ...property, cachedAt: Date.now() })

  const index = store.index('by-cachedAt')
  const allKeys = await index.getAllKeys()

  if (allKeys.length > MAX_CACHED_PROPERTIES) {
    const keysToDelete = allKeys.slice(0, allKeys.length - MAX_CACHED_PROPERTIES)
    for (const key of keysToDelete) {
      await store.delete(key)
    }
  }
  await tx.done
}

export async function getCachedProperty(id: string): Promise<PropertyCache | undefined> {
  const db = await getDB()
  return db.get('cached_properties', id)
}

export async function getAllCachedProperties(): Promise<PropertyCache[]> {
  const db = await getDB()
  return db.getAll('cached_properties')
}

export async function enqueueOfflineAction(
  type: OfflineAction['type'],
  payload: Record<string, any>
): Promise<number> {
  const db = await getDB()
  return db.add('sync_queue', { type, payload, timestamp: Date.now(), retryCount: 0 })
}

export async function getSyncQueue(): Promise<OfflineAction[]> {
  const db = await getDB()
  return db.getAll('sync_queue')
}

export async function clearQueueItem(id: number): Promise<void> {
  const db = await getDB()
  return db.delete('sync_queue', id)
}

export async function incrementRetryOrDeadLetter(id: number): Promise<'retrying' | 'dead-lettered'> {
  const db = await getDB()
  const item = await db.get('sync_queue', id)
  if (!item) return 'retrying'

  const nextRetryCount = item.retryCount + 1
  if (nextRetryCount >= MAX_RETRY_COUNT) {
    await db.delete('sync_queue', id)
    return 'dead-lettered'
  }

  await db.put('sync_queue', { ...item, retryCount: nextRetryCount })
  return 'retrying'
}
