import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface WorkspaceItem {
  id: string
  title: string
  leadName: string | null
  leadPhone: string | null
  leadSource: string
  stage: string
  dueDate: string | null
}

export interface AgentBookingView {
  id: string
  scheduledAt: string
  status: string
  hunterConfirmedViewing: boolean
  propertyTitle: string
}

export interface DashboardData {
  totalListings: number
  activeListings: number
  items: WorkspaceItem[]
  bookings: AgentBookingView[]
}

export interface NewListingInput {
  title: string
  description: string
  price: number
  type: string
  county: string
  sub_county: string
  neighborhood: string
  bedrooms: number
  bathrooms: number
  images: string[]
}

interface UseAgentDashboardResult {
  loading: boolean
  data: DashboardData
  addListing: (profileId: string, input: NewListingInput) => Promise<boolean>
  addLead: (profileId: string, leadName: string, leadPhone: string) => Promise<boolean>
}

const DAY = 24 * 60 * 60 * 1000

function iso(offsetDays: number, hour = 10): string {
  const d = new Date(Date.now() + offsetDays * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const DEMO_DASHBOARD_DATA: DashboardData = {
  totalListings: 4,
  activeListings: 4,
  items: [
    {
      id: 'demo-lead-1',
      title: '3-Bed Townhouse, Karen',
      leadName: 'Wanjala family',
      leadPhone: '+254 722 000 111',
      leadSource: 'whatsapp',
      stage: 'new_lead',
      dueDate: null
    },
    {
      id: 'demo-lead-2',
      title: 'Bedsitter, Kilimani',
      leadName: 'Nyambura',
      leadPhone: '+254 733 222 333',
      leadSource: 'manual',
      stage: 'new_lead',
      dueDate: null
    },
    {
      id: 'demo-lead-3',
      title: '4-Bed Villa, Milimani Kisumu',
      leadName: 'Ochieng',
      leadPhone: '+254 711 444 555',
      leadSource: 'referral',
      stage: 'contacted',
      dueDate: iso(2, 14)
    },
    {
      id: 'demo-lead-4',
      title: '2-Bed Apartment, Kileleshwa',
      leadName: 'Kamau',
      leadPhone: '+254 720 666 777',
      leadSource: 'search',
      stage: 'viewing_booked',
      dueDate: iso(1, 11)
    },
    {
      id: 'demo-lead-5',
      title: 'Townhouse lease signed, Karen',
      leadName: 'Achieng',
      leadPhone: null,
      leadSource: 'whatsapp',
      stage: 'closed',
      dueDate: null
    }
  ],
  bookings: [
    {
      id: 'demo-viewing-1',
      scheduledAt: iso(1, 10),
      status: 'confirmed',
      hunterConfirmedViewing: false,
      propertyTitle: 'Sunlit 2-Bedroom in Kilimani'
    },
    {
      id: 'demo-viewing-2',
      scheduledAt: iso(3, 15),
      status: 'confirmed',
      hunterConfirmedViewing: false,
      propertyTitle: 'Modern 4-Bed Villa, Milimani Kisumu'
    },
    {
      id: 'demo-viewing-3',
      scheduledAt: iso(-2, 12),
      status: 'completed',
      hunterConfirmedViewing: true,
      propertyTitle: 'Garden Townhouse, Karen'
    }
  ]
}

export function useAgentDashboard(): UseAgentDashboardResult {
  const [data, setData] = useState<DashboardData>(DEMO_DASHBOARD_DATA)
  const [loading, setLoading] = useState(() => Boolean(supabase))

  async function addListing(profileId: string, input: NewListingInput): Promise<boolean> {
    if (!supabase) {
      setData((prev) => ({
        ...prev,
        totalListings: prev.totalListings + 1,
        activeListings: prev.activeListings + 1
      }))
      return true
    }

    const { error } = await supabase.from('properties').insert({
      agent_id: profileId,
      status: 'published',
      ...input
    })
    if (error) return false

    setData((prev) => ({
      ...prev,
      totalListings: prev.totalListings + 1,
      activeListings: prev.activeListings + 1
    }))
    return true
  }

  async function addLead(profileId: string, leadName: string, leadPhone: string): Promise<boolean> {
    const item: WorkspaceItem = {
      id: `local-${Date.now()}`,
      title: 'New enquiry',
      leadName,
      leadPhone: leadPhone || null,
      leadSource: 'manual',
      stage: 'new_lead',
      dueDate: null
    }

    if (!supabase) {
      setData((prev) => ({ ...prev, items: [item, ...prev.items] }))
      return true
    }

    const { error } = await supabase.from('agent_workspace_items').insert({
      agent_id: profileId,
      title: item.title,
      lead_name: leadName,
      lead_phone: leadPhone || null,
      lead_source: 'manual',
      stage: 'new_lead'
    })
    if (error) return false

    setData((prev) => ({ ...prev, items: [item, ...prev.items] }))
    return true
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const [listingsRes, itemsRes, bookingsRes] = await Promise.all([
        supabase.from('properties').select('id,status'),
        supabase
          .from('agent_workspace_items')
          .select('id,title,lead_name,lead_phone,lead_source,stage,due_date')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('bookings')
          .select('id,scheduled_at,status,hunter_confirmed_viewing,properties(title)')
          .order('scheduled_at', { ascending: true })
          .limit(30)
      ])

      if (cancelled) return

      const rows = bookingsRes.data ?? []
      setData({
        totalListings: listingsRes.data?.length ?? 0,
        activeListings: listingsRes.data?.filter((p) => p.status === 'published').length ?? 0,
        items: (itemsRes.data ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          leadName: item.lead_name,
          leadPhone: item.lead_phone,
          leadSource: item.lead_source,
          stage: item.stage,
          dueDate: item.due_date
        })),
        bookings: rows.map((row) => ({
          id: row.id,
          scheduledAt: row.scheduled_at,
          status: row.status,
          hunterConfirmedViewing: row.hunter_confirmed_viewing,
          propertyTitle: (row.properties as { title?: string } | null)?.title ?? 'Property viewing'
        }))
      })
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return { loading, data, addListing, addLead }
}
