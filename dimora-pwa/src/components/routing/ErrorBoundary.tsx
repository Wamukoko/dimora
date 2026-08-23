import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dimora crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-limewash px-6 text-center">
          <p className="font-display text-xl font-bold text-ink">Something broke on our side.</p>
          <p className="max-w-xs text-sm leading-relaxed text-neutral-600">
            Your saved listings are safe on this device. Reload to pick up where you left off.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-terracotta px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-hover"
          >
            Reload Dimora
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
