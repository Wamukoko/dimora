import type { Property, PublicProfile, VerificationKind } from '@/types/database'

const px = (id: string, w = 900) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`

export const DEMO_AGENT: PublicProfile = {
  id: 'demo-agent',
  full_name: 'Amina Wanjiru',
  avatar_url: null,
  role: 'agent'
}

export const DEMO_VERIFIED_KINDS: VerificationKind[] = ['site_visit', 'title_deed', 'agent_id']

export const DEMO_PROPERTIES: Property[] = [
  {
    id: 'demo-kilimani',
    agent_id: DEMO_AGENT.id,
    title: 'Sunlit 2-Bedroom in Kilimani',
    description: 'Modern apartment a walk from Yaya Centre. Borehole water, backup generator, secure parking.',
    price: 85000,
    type: 'apartment',
    bedrooms: 2,
    bathrooms: 1,
    county: 'Nairobi',
    sub_county: 'Nairobi West',
    neighborhood: 'Kilimani',
    images: [px('271624'), px('1571460')],
    is_published: true,
    is_verified: true
  },
  {
    id: 'demo-karen',
    agent_id: DEMO_AGENT.id,
    title: 'Family Townhouse in Karen',
    description: 'Four-bedroom townhouse on a quarter acre. Mature garden, staff quarters, quiet cul-de-sac.',
    price: 180000,
    type: 'townhouse',
    bedrooms: 4,
    bathrooms: 3,
    county: 'Nairobi',
    sub_county: 'Nairobi West',
    neighborhood: 'Karen',
    images: [px('106399'), px('1396122')],
    is_published: true,
    is_verified: true
  },
  {
    id: 'demo-kileleshwa',
    agent_id: DEMO_AGENT.id,
    title: 'Clean Bedsitter in Kileleshwa',
    description: 'Self-contained unit with private bathroom and kitchenette. Water always available.',
    price: 16000,
    type: 'bedsitter',
    bedrooms: 0,
    bathrooms: 1,
    county: 'Nairobi',
    sub_county: 'Nairobi West',
    neighborhood: 'Kileleshwa',
    images: [px('210617'), px('1571459')],
    is_published: true,
    is_verified: false
  },
  {
    id: 'demo-milimani',
    agent_id: DEMO_AGENT.id,
    title: '4BR House in Milimani, Kisumu',
    description: 'Spacious family home near Milimani Primary. Large compound, fruit trees, perimeter wall.',
    price: 70000,
    type: 'house',
    bedrooms: 4,
    bathrooms: 2,
    county: 'Kisumu',
    sub_county: 'Kisumu East',
    neighborhood: 'Milimani',
    images: [px('186077'), px('323780')],
    is_published: true,
    is_verified: false
  }
]
