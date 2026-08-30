import { supabase } from '@/lib/supabaseClient'

export type ListingEventType = 'view' | 'whatsapp_click'

const EVENT_COOLDOWN_MS = 30_000
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60

const lastFired = new Map<string, number>()
const windowStarts: number[] = []

function recentCount(): number {
  const now = Date.now()
  while (windowStarts.length > 0 && windowStarts[0] < now - WINDOW_MS) windowStarts.shift()
  return windowStarts.length
}

export function resetAnalyticsThrottle(): void {
  lastFired.clear()
  windowStarts.length = 0
}

export async function trackListingEvent(
  propertyId: string,
  eventType: ListingEventType
): Promise<void> {
  if (!supabase) return

  const now = Date.now()
  const key = `${propertyId}:${eventType}`

  if ((lastFired.get(key) ?? 0) > now - EVENT_COOLDOWN_MS) return
  if (recentCount() >= MAX_PER_WINDOW) return

  lastFired.set(key, now)
  windowStarts.push(now)

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user.id) return

  await supabase
    .from('listing_events')
    .insert({ property_id: propertyId, event_type: eventType })
}