export type PropertyType = 'apartment' | 'house' | 'bedsitter' | 'townhouse' | 'commercial' | 'land'

export type UserRole = 'hunter' | 'agent' | 'admin'

export interface Property {
  id: string
  agent_id: string
  title: string
  description: string | null
  price: number
  type: PropertyType
  bedrooms: number
  bathrooms: number
  county: string
  sub_county: string
  neighborhood: string
  images: string[]
  is_published: boolean
  is_verified: boolean
  is_boosted?: boolean
  boost_expires_at?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface PublicProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
}

export type VerificationKind = 'site_visit' | 'title_deed' | 'agent_id' | 'registry_crosscheck'

export const verificationKindLabels: Record<VerificationKind, string> = {
  site_visit: 'Site visit',
  title_deed: 'Title deed',
  agent_id: 'Agent ID',
  registry_crosscheck: 'Registry check'
}

export type RentLedgerStatus = 'due' | 'partial' | 'paid' | 'overdue'

export interface RentLedgerEntry {
  id: string
  propertyId: string
  propertyTitle: string
  periodStart: string
  periodEnd: string
  amountDue: number
  amountPaid: number
  status: RentLedgerStatus
  createdAt: string
}

export interface AgentKyc {
  agentId: string
  agentName: string
  agentEmail: string | null
  kraPin: string | null
  idDocumentUrl: string | null
  selfieUrl: string | null
  status: string
  reviewedAt: string | null
  createdAt: string
}

export interface ComparableProperty {
  id: string
  title: string
  price: number
  type: PropertyType
  neighborhood: string
  county: string
  bedrooms: number
  images: string[]
}

export interface ListingStats {
  propertyId: string
  title: string
  views: number
  favorites: number
  bookings: number
  whatsapp: number
  isBoosted: boolean
}
