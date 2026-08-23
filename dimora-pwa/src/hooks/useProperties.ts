import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { cacheProperty, getAllCachedProperties, type PropertyCache } from '@/lib/indexedDB'
import { DEMO_PROPERTIES } from '@/lib/demoData'
import type { Property } from '@/types/database'

const SELECT_COLUMNS =
  'id, agent_id, title, description, price, type, bedrooms, bathrooms, county, sub_county, neighborhood, images, is_published, is_verified'

function toCacheShape(p: Property): Omit<PropertyCache, 'cachedAt'> {
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    county: p.county,
    sub_county: p.sub_county,
    neighborhood: p.neighborhood,
    images: p.images ?? [],
    type: p.type,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    is_verified: p.is_verified
  }
}

function fromCacheShape(c: PropertyCache): Property {
  return {
    id: c.id,
    agent_id: '',
    title: c.title,
    description: null,
    price: c.price,
    type: c.type as Property['type'],
    bedrooms: c.bedrooms,
    bathrooms: c.bathrooms,
    county: c.county,
    sub_county: c.sub_county,
    neighborhood: c.neighborhood,
    images: c.images,
    is_published: true,
    is_verified: c.is_verified
  }
}

interface UsePropertiesResult {
  properties: Property[]
  loading: boolean
  source: 'network' | 'cache' | null
}

export function useProperties(limit = 50): UsePropertiesResult {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'network' | 'cache' | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      if (!supabase) {
        setProperties(DEMO_PROPERTIES)
        setSource('network')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('properties')
        .select(SELECT_COLUMNS)
        .eq('is_published', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (cancelled) return

      if (!error && data) {
        setProperties(data as Property[])
        setSource('network')
        setLoading(false)
        for (const p of data as Property[]) {
          void cacheProperty(toCacheShape(p))
        }
        return
      }

      const cached = await getAllCachedProperties()
      if (!cancelled) {
        setProperties(cached.sort((a, b) => b.cachedAt - a.cachedAt).map(fromCacheShape))
        setSource(error ? 'cache' : 'network')
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [limit])

  return { properties, loading, source }
}
