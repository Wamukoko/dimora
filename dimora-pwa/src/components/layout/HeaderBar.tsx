import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function HeaderBar({ mode = 'hunter' }: { mode?: 'hunter' | 'agent' }) {
  const { profile } = useAuth()
  const agentMode = mode === 'agent'

  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur ${
        agentMode ? 'border-white/10 bg-agent/90 text-white' : 'border-line bg-limewash/80'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-hunter items-center justify-between px-4">
        <Link to={profile?.role === 'agent' ? '/dashboard' : '/'} className="font-display text-xl font-bold tracking-tight">
          Dimora<span className="text-terracotta">.</span>
        </Link>

        <div className="flex items-center gap-3">
          {profile ? (
            <>
              {profile.role === 'admin' && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${agentMode ? 'bg-white/10' : 'bg-white'}`}>
                  admin
                </span>
              )}
              <Link
                to="/profile"
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  profile.role === 'agent' && !agentMode
                    ? 'bg-agent text-white'
                    : 'bg-terracotta text-white'
                }`}
                aria-label="Your profile"
              >
                {(profile.full_name ?? profile.email)[0]?.toUpperCase()}
              </Link>
            </>
          ) : (
            <Link to="/login" className="text-sm font-medium hover:text-terracotta">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
