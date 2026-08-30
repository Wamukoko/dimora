import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { findComparables } from '@/lib/comparables'
import { DEMO_PROPERTIES } from '@/lib/demoData'
import type { ComparableProperty, Property } from '@/types/database'

interface UsePriceComparisonResult {
  comparables: ComparableProperty[]
  loading: boolean
}

function demoCandidates(): ComparableProperty[] {
  return DEMO_PROPERTIES.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    type: p.type,
    neighborhood: p.neighborhood,
    county: p.county,
    bedrooms: p.bedrooms,
    images: p.images
  }))
}

function isDemoProperty(property: Property | null): boolean {
  return Boolean(property && DEMO_PROPERTIES.some((p) => p.id === property.id))
}

export function usePriceComparison(property: Property | null): UsePriceComparisonResult {
  const [comparables, setComparables] = useState<ComparableProperty[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!property) {
      setComparables([])
      return
    }

    const prop = property

    if (!supabase || isDemoProperty(prop)) {
      setComparables(findComparables(prop, demoCandidates()))
      return
    }

    const client = supabase
    setLoading(true)

    async function load() {
      const { data } = await client
        .from('properties')
        .select('id,title,price,type,neighborhood,county,bedrooms,images')
        .eq('is_published', true)
        .eq('county', prop.county)
        .neq('id', prop.id)
        .limit(10)

      if (cancelled) return

      const candidates = (data ?? [])
        .filter((row) => Array.isArray(row.images))
        .map((row) => ({
          id: row.id,
          title: row.title,
          price: Number(row.price),
          type: row.type as ComparableProperty['type'],
          neighborhood: row.neighborhood,
          county: row.county,
          bedrooms: row.bedrooms,
          images: row.images ?? []
        }))

      setComparables(findComparables(prop, candidates))
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [property?.id])

  return { comparables, loading }
}