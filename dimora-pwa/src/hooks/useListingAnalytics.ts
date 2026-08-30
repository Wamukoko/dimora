import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { ListingStats } from '@/types/database'

const DEMO_STATS: ListingStats[] = [
  { propertyId: 'demo-kilimani', title: 'Sunlit 2-Bedroom in Kilimani', views: 148, favorites: 22, bookings: 9, whatsapp: 31, isBoosted: true },
  { propertyId: 'demo-karen', title: 'Family Townhouse in Karen', views: 96, favorites: 14, bookings: 4, whatsapp: 12, isBoosted: false },
  { propertyId: 'demo-kileleshwa', title: 'Clean Bedsitter in Kileleshwa', views: 201, favorites: 30, bookings: 15, whatsapp: 44, isBoosted: false },
  { propertyId: 'demo-milimani', title: '4BR House in Milimani, Kisumu', views: 54, favorites: 6, bookings: 2, whatsapp: 8, isBoosted: false }
]

interface UseListingAnalyticsResult {
  stats: ListingStats[]
  loading: boolean
}

export function useListingAnalytics(agentId: string | undefined): UseListingAnalyticsResult {
  const [stats, setStats] = useState<ListingStats[]>([])
  const [loading, setLoading] = useState(() => Boolean(supabase))

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase || !agentId) {
        setStats(DEMO_STATS)
        setLoading(false)
        return
      }

      const { data: properties, error } = await supabase
        .from('properties')
        .select('id,title,is_boosted,boost_expires_at')
        .eq('agent_id', agentId)

      if (cancelled) return
      if (error || !properties) {
        setLoading(false)
        return
      }

      const ids = properties.map((p) => p.id)
      const fallback: ListingStats[] = properties.map((p) => ({
        propertyId: p.id,
        title: p.title,
        views: 0,
        favorites: 0,
        bookings: 0,
        whatsapp: 0,
        isBoosted: Boolean(p.is_boosted)
      }))
      if (ids.length === 0) {
        setStats(fallback)
        setLoading(false)
        return
      }

      const [eventsRes, favoritesRes, bookingsRes] = await Promise.all([
        supabase.from('listing_events').select('property_id,event_type').in('property_id', ids),
        supabase.from('favorites').select('property_id').in('property_id', ids),
        supabase.from('bookings').select('property_id').in('property_id', ids)
      ])
      if (cancelled) return

      const counts = new Map<string, Map<string, number>>()
      const events = eventsRes.data ?? []
      const favoriteCounts = new Map<string, number>()
      for (const row of events) {
        const perProperty = counts.get(row.property_id) ?? new Map<string, number>()
        perProperty.set(row.event_type, (perProperty.get(row.event_type) ?? 0) + 1)
        counts.set(row.property_id, perProperty)
      }
      for (const row of favoritesRes.data ?? []) {
        favoriteCounts.set(row.property_id, (favoriteCounts.get(row.property_id) ?? 0) + 1)
      }
      const bookingCounts = new Map<string, number>()
      for (const row of bookingsRes.data ?? []) {
        bookingCounts.set(row.property_id, (bookingCounts.get(row.property_id) ?? 0) + 1)
      }

      const now = Date.now()
      setStats(
        properties.map((p) => {
          const perProperty = counts.get(p.id) ?? new Map<string, number>()
          const boostActive = Boolean(p.is_boosted) && (p.boost_expires_at == null || new Date(p.boost_expires_at).getTime() >= now)
          return {
            propertyId: p.id,
            title: p.title,
            views: perProperty.get('view') ?? 0,
            favorites: favoriteCounts.get(p.id) ?? 0,
            bookings: bookingCounts.get(p.id) ?? 0,
            whatsapp: perProperty.get('whatsapp_click') ?? 0,
            isBoosted: boostActive
          }
        })
      )
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [agentId])

  return { stats, loading }
}

export function totalFromStats(stats: ListingStats[]): { views: number; favorites: number; bookings: number; whatsapp: number } {
  return stats.reduce(
    (totals, stat) => ({
      views: totals.views + stat.views,
      favorites: totals.favorites + stat.favorites,
      bookings: totals.bookings + stat.bookings,
      whatsapp: totals.whatsapp + stat.whatsapp
    }),
    { views: 0, favorites: 0, bookings: 0, whatsapp: 0 }
  )
}