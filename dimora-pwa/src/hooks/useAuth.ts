import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, NOT_CONFIGURED_MESSAGE } from '@/lib/supabaseClient'

export type UserRole = 'hunter' | 'agent' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone_number: string | null
  role: UserRole
  avatar_url: string | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
}

const DEMO_SESSION_KEY = 'dimora-demo-profile'

function loadDemoProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: Boolean(supabase)
  })
  const [demoProfile, setDemoProfile] = useState<Profile | null>(loadDemoProfile)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setState((s) => ({ ...s, session: data.session, user: data.session?.user ?? null, loading: false }))
      if (data.session?.user) void loadProfile(data.session.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }))
      if (session?.user) void loadProfile(session.user.id)
      else setState((s) => ({ ...s, profile: null }))
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone_number, role, avatar_url')
      .eq('id', userId)
      .single()

    if (!error && data) setState((s) => ({ ...s, profile: data as Profile }))
  }

  async function signInWithMagicLink(email: string): Promise<{ error: string | null }> {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    return { error: error ? error.message : null }
  }

  async function signInWithGoogle(): Promise<{ error: string | null }> {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    return { error: error ? error.message : null }
  }

  function signInAsDemo(role: UserRole) {
    const demoProfile: Profile =
      role === 'agent'
        ? { id: 'demo-agent', email: 'amina@demo.dimora', full_name: 'Amina Wanjiru', phone_number: '+254 700 111 222', role: 'agent', avatar_url: null }
        : { id: 'demo-hunter', email: 'brian@demo.dimora', full_name: 'Brian Otieno', phone_number: '+254 700 333 444', role: 'hunter', avatar_url: null }
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(demoProfile))
    setDemoProfile(demoProfile)
  }

  async function signOut() {
    localStorage.removeItem(DEMO_SESSION_KEY)
    setDemoProfile(null)
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const profile = state.profile ?? demoProfile
  const isAuthed = Boolean(state.session) || Boolean(demoProfile)

  return {
    session: state.session,
    user: state.user,
    profile,
    loading: state.loading && !demoProfile,
    isAuthed,
    signInWithMagicLink,
    signInWithGoogle,
    signInAsDemo,
    signOut
  }
}
