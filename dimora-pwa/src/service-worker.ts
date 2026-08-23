import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { SYNC_TAG, processSyncQueue } from '@/lib/sync'

interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void
}

interface SyncEvent extends ExtendableEventLike {
  tag: string
}

interface ServiceWorkerContext {
  __WB_MANIFEST: unknown[]
  addEventListener(type: 'sync', handler: (event: SyncEvent) => void): void
  addEventListener(type: 'install', handler: (event: ExtendableEventLike) => void): void
}

declare const self: ServiceWorkerContext

precacheAndRoute(self.__WB_MANIFEST as never)
cleanupOutdatedCaches()

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/properties'),
  new NetworkFirst({
    cacheName: 'supabase-properties-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 })]
  })
)

registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/public/'),
  new CacheFirst({
    cacheName: 'supabase-listing-images-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 604800 })]
  })
)

registerRoute(
  ({ url }) => url.hostname === 'images.pexels.com',
  new CacheFirst({
    cacheName: 'pexels-images-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 604800 })]
  })
)

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processSyncQueue())
  }
})
