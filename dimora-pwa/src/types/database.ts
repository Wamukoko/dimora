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
