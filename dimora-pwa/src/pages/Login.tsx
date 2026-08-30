import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

export default function Login() {
  const { signInWithMagicLink, signInWithGoogle, signInAsDemo } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await signInWithMagicLink(email.trim())
    setBusy(false)
    if (err) setError(err)
    else setSent(true)
  }

  async function handleGoogle() {
    setError(null)
    const { error: err } = await signInWithGoogle()
    if (err) setError(err)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-hunter flex-col justify-center px-4">
      <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome to Dimora<span className="text-terracotta">.</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Verified homes across Kenya. Sign in to book viewings and save listings.
        </p>

        {sent ? (
          <div
            role="status"
            className="mt-6 rounded-xl bg-verified/10 px-4 py-3 text-sm text-verified"
          >
            Check your inbox — we sent a sign-in link to <strong>{email}</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-neutral-500">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-line bg-limewash/40 px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-terracotta"
              />
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                New here? This <strong className="font-medium text-neutral-500">creates your account</strong> — no
                password, we just email you a secure link.
              </p>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy}>
              {busy ? 'Sending link…' : 'Continue with email'}
            </Button>

            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button type="button" variant="secondary" size="lg" onClick={handleGoogle}>
              Continue with Google
            </Button>
          </form>
        )}

        <div className="mt-6 rounded-xl bg-limewash/60 p-4">
          <p className="text-center text-xs font-medium text-neutral-500">No account? Take a look around:</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                signInAsDemo('hunter')
                navigate('/')
              }}
            >
              Browse as hunter
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                signInAsDemo('agent')
                navigate('/dashboard')
              }}
            >
              Open agent CRM
            </Button>
          </div>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => {
              signInAsDemo('admin')
              navigate('/admin')
            }}
          >
            Open admin consoles
          </Button>
        </div>
      </div>
    </main>
  )
}
