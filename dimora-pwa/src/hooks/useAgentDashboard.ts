import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { findExistingLead, type LeadSource } from '@/lib/leads'

export interface WorkspaceItem {
  id: string
  title: string
  leadName: string | null
  leadPhone: string | null
  email?: string | null
  leadSource: string
  stage: string
  dueDate: string | null
  notes?: string | null
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
  // Financial features (COMING SOON - Phase 1)
  financialData?: {
    totalRevenue: number
    pendingPayments: number
    escrowHeld: number
    payoutsProcessed: number
    paymentSuccessRate: number
  }
  // Analytics features (COMING SOON - Phase 1)
  analyticsData?: {
    listingViews: number
    conversionRate: number
    averageResponseTime: number
    topPerformingListings: string[]
    monthlyTrends: { month: string; revenue: number }[]
  }
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

export interface LeadInput {
  name: string
  phone: string
  email?: string
  source?: LeadSource
  context?: string
  notes?: string
  dueDate?: string
  stage?: string
}

export type AddLeadResult =
  | { ok: true }
  | { ok: false; duplicate: boolean; error?: string }

interface UseAgentDashboardResult {
  loading: boolean
  data: DashboardData
  addListing: (profileId: string, input: NewListingInput, files?: File[]) => Promise<boolean>
  addLead: (profileId: string, input: LeadInput, force?: boolean) => Promise<AddLeadResult>
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
  ],
  // Financial features (COMING SOON - Phase 1)
  financialData: {
    totalRevenue: 0,
    pendingPayments: 0,
    escrowHeld: 0,
    payoutsProcessed: 0,
    paymentSuccessRate: 0
  },
  // Analytics features (COMING SOON - Phase 1)
  analyticsData: {
    listingViews: 0,
    conversionRate: 0,
    averageResponseTime: 0,
    topPerformingListings: [],
    monthlyTrends: []
  }
}

export function useAgentDashboard(): UseAgentDashboardResult {
  const [data, setData] = useState<DashboardData>(DEMO_DASHBOARD_DATA)
  const [loading, setLoading] = useState(() => Boolean(supabase))

  async function addListing(profileId: string, input: NewListingInput, files: File[] = []): Promise<boolean> {
    if (!supabase) {
      setData((prev) => ({
        ...prev,
        totalListings: prev.totalListings + 1,
        activeListings: prev.activeListings + 1
      }))
      return true
    }

    const { data: created, error } = await supabase
      .from('properties')
      .insert({ agent_id: profileId, ...input })
      .select('id')
      .single()
    if (error || !created) return false

    const uploadedUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const ext = files[i].name.split('.').pop() ?? 'jpg'
      const path = `${profileId}/${created.id}/${i}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(path, files[i], { cacheControl: '3600', upsert: false })
      if (uploadError) continue
      const { data: publicUrl } = supabase.storage.from('property-images').getPublicUrl(path)
      if (publicUrl?.publicUrl) uploadedUrls.push(publicUrl.publicUrl)
    }

    if (uploadedUrls.length > 0) {
      await supabase
        .from('properties')
        .update({ images: [...input.images, ...uploadedUrls] })
        .eq('id', created.id)
    }

    setData((prev) => ({
      ...prev,
      totalListings: prev.totalListings + 1,
      activeListings: prev.activeListings + 1
    }))
    return true
  }

  async function addLead(profileId: string, input: LeadInput, force = false): Promise<AddLeadResult> {
    const email = input.email?.trim().toLowerCase() || null
    const item: WorkspaceItem = {
      id: `local-${Date.now()}`,
      title: input.context?.trim() || 'New enquiry',
      leadName: input.name.trim(),
      leadPhone: input.phone.trim() || null,
      email,
      leadSource: input.source ?? 'manual',
      stage: input.stage ?? 'new_lead',
      dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      notes: input.notes?.trim() || null
    }

    if (!supabase) {
      if (!force && findExistingLead(data.items, input.phone, email ?? undefined)) {
        return { ok: false, duplicate: true }
      }
      setData((prev) => ({ ...prev, items: [item, ...prev.items] }))
      return { ok: true }
    }

    const phone = input.phone.trim().replace(/\D/g, '')
    const { data: existingRow } = await supabase
      .from('agent_workspace_items')
      .select('id')
      .eq('agent_id', profileId)
      .eq('lead_phone', phone)
      .maybeSingle()
    if (existingRow && !force) return { ok: false, duplicate: true }

    const { error } = await supabase.from('agent_workspace_items').insert({
      agent_id: profileId,
      title: item.title,
      lead_name: item.leadName,
      lead_phone: phone,
      lead_email: email,
      lead_source: item.leadSource,
      stage: item.stage,
      notes: item.notes,
      due_date: item.dueDate
    })
    if (error) return { ok: false, duplicate: false, error: error.message }

    setData((prev) => ({ ...prev, items: [item, ...prev.items] }))
    return { ok: true }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const [listingsRes, itemsRes, bookingsRes] = await Promise.all([
        supabase.from('properties').select('id,is_published'),
        supabase
          .from('agent_workspace_items')
          .select('id,title,lead_name,lead_phone,lead_email,lead_source,stage,notes,due_date')
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
        activeListings: listingsRes.data?.filter((p) => p.is_published).length ?? 0,
        items: (itemsRes.data ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          leadName: item.lead_name,
          leadPhone: item.lead_phone,
          email: item.lead_email,
          leadSource: item.lead_source,
          stage: item.stage,
          notes: item.notes,
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
