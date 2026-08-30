import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { InstallBanner } from '@/components/ui/InstallBanner'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function createPromptEvent(outcome: 'accepted' | 'dismissed'): InstallPromptEvent {
  const event = new Event('beforeinstallprompt') as InstallPromptEvent
  event.prompt = vi.fn(async () => undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

function dispatch(type: string, event: Event) {
  act(() => {
    listeners[type]?.[0]?.(event)
  })
}

let listeners: Record<string, ((event: Event) => void)[]> = {}

beforeEach(() => {
  listeners = {}
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  vi.stubGlobal('addEventListener', (type: string, handler: (event: Event) => void) => {
    listeners[type] = [...(listeners[type] ?? []), handler]
  })
  vi.stubGlobal('removeEventListener', (type: string, handler: (event: Event) => void) => {
    listeners[type] = (listeners[type] ?? []).filter((h) => h !== handler)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InstallBanner', () => {
  it('renders nothing before the browser fires beforeinstallprompt', () => {
    render(<InstallBanner />)
    expect(screen.queryByLabelText('Install the app')).toBeNull()
  })

  it('shows the prompt once beforeinstallprompt fires, then hides on "Not now"', () => {
    render(<InstallBanner />)
    dispatch('beforeinstallprompt', createPromptEvent('dismissed'))

    expect(screen.getByText('Take Dimora with you')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('Take Dimora with you')).toBeNull()
  })

  it('calls prompt() on install and hides when the user accepts', async () => {
    render(<InstallBanner />)
    const event = createPromptEvent('accepted')
    dispatch('beforeinstallprompt', event)

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    expect(event.prompt).toHaveBeenCalledTimes(1)

    // Let the prompt() + userChoice microtasks settle before asserting hide.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(screen.queryByText('Take Dimora with you')).toBeNull()
  })

  it('hides immediately when already installed as a standalone app', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    render(<InstallBanner />)
    expect(screen.queryByText('Take Dimora with you')).toBeNull()
  })

  it('never shows while in a browser without the event (times out into dismissed)', () => {
    render(<InstallBanner />)
    expect(screen.queryByText('Take Dimora with you')).toBeNull()
  })
})