import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO_PROPERTIES } from '@/lib/demoData'

export interface AgentListingRow {
  id: string
  title: string
  price: number
  county: string
  neighborhood: string
  images: string[]
  isPublished: boolean
  isVerified: boolean
}

function demoRows(): AgentListingRow[] {
  return DEMO_PROPERTIES.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    county: p.county,
    neighborhood: p.neighborhood,
    images: p.images,
    isPublished: p.is_published,
    isVerified: p.is_verified
  }))
}

interface UseAgentListingsResult {
  rows: AgentListingRow[]
  loading: boolean
  error: string | null
  togglePublished: (row: AgentListingRow) => Promise<boolean>
}

export function useAgentListings(profileId?: string): UseAgentListingsResult {
  const [rows, setRows] = useState<AgentListingRow[]>([])
  const [loading, setLoading] = useState(() => Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase) {
        setRows(demoRows())
        setLoading(false)
        return
      }
      if (!profileId) {
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('properties')
        .select('id,title,price,county,neighborhood,images,is_published,is_verified')
        .eq('agent_id', profileId)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (err) setError(err.message)
      setRows(
        (data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          price: Number(row.price),
          county: row.county,
          neighborhood: row.neighborhood,
          images: row.images ?? [],
          isPublished: row.is_published,
          isVerified: row.is_verified
        }))
      )
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [profileId])

  async function togglePublished(row: AgentListingRow): Promise<boolean> {
    const next = !row.isPublished

    if (supabase && profileId) {
      const { error: err } = await supabase
        .from('properties')
        .update({ is_published: next })
        .eq('id', row.id)
        .eq('agent_id', profileId)
      if (err) {
        setError(err.message)
        return false
      }
    }

    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isPublished: next } : r)))
    return true
  }

  return { rows, loading, error, togglePublished }
}
