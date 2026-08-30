import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PropertyTypeIcon, PROPERTY_TYPES } from '@/components/ui/PropertyTypeIcons'
import { TrustBadgeIcon, TRUST_BADGE_KINDS } from '@/components/ui/TrustBadgeIcons'

describe('PropertyTypeIcon', () => {
  it('renders an svg for every property type', () => {
    for (const type of PROPERTY_TYPES) {
      const { container } = render(<PropertyTypeIcon type={type} />)
      expect(container.querySelector('svg')).toBeTruthy()
    }
  })

  it('applies custom class names', () => {
    const { container } = render(<PropertyTypeIcon type="house" className="h-4 w-4" />)
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('h-4 w-4')
  })

  it('is hidden from screen readers', () => {
    const { container } = render(<PropertyTypeIcon type="land" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('TrustBadgeIcon', () => {
  it('renders an svg for every verification kind', () => {
    for (const kind of TRUST_BADGE_KINDS) {
      const { container } = render(<TrustBadgeIcon kind={kind} />)
      expect(container.querySelector('svg')).toBeTruthy()
    }
  })

  it('renders a removable svg for the title deed (compass on document)', () => {
    const { container } = render(<TrustBadgeIcon kind="title_deed" />)
    expect(container.querySelectorAll('svg path').length).toBeGreaterThan(3)
  })

  it('is hidden from screen readers', () => {
    const { container } = render(<TrustBadgeIcon kind="site_visit" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})