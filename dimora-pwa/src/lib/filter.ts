import type { Property } from '@/types/database'

export function filterProperties(
  properties: Property[],
  query: string,
  type: string | null
): Property[] {
  const q = query.trim().toLowerCase()
  return properties.filter((p) => {
    if (type && p.type !== type) return false
    if (!q) return true
    return (
      p.title.toLowerCase().includes(q) ||
      p.neighborhood.toLowerCase().includes(q) ||
      p.sub_county.toLowerCase().includes(q) ||
      p.county.toLowerCase().includes(q)
    )
  })
}