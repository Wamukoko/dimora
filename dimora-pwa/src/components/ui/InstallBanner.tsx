import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type BannerState = 'loading' | 'promptable' | 'installed' | 'dismissed'

export function InstallBanner() {
  const [state, setState] = useState<BannerState>('loading')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setState('installed')
      return
    }

    const onBeforeInstall = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setDeferred(promptEvent)
      setState('promptable')
    }
    const onAppInstalled = () => setState('installed')

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  if (state !== 'promptable' || !deferred) return null

  const install = async () => {
    await deferred.prompt()
    const choice = await deferred.userChoice
    setState(choice.outcome === 'accepted' ? 'installed' : 'dismissed')
  }

  return (
    <div
      role="region"
      aria-label="Install the app"
      className="fixed inset-x-0 bottom-24 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-hunter items-start justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Take Dimora with you</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
          Install the app — book viewings and browse saved listings even offline.
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-lg bg-terracotta px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terracotta-hover"
          >
            Install app
          </button>
          <button
            type="button"
            onClick={() => setState('dismissed')}
            className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-terracotta"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setState('dismissed')}
        aria-label="Dismiss install prompt"
        className="shrink-0 rounded-full p-1 text-neutral-400 transition-colors hover:text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  )
}