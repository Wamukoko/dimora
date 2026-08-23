import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useEscrowRelease() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function releaseDeposit(bookingId: string): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      if (!supabase) throw new Error('Escrow release needs a connected Supabase project')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('You need to sign in first')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/release-escrow`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ bookingId })
        }
      )

      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Could not release the deposit')
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, releaseDeposit }
}
