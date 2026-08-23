import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type StkPushState = 'idle' | 'sending' | 'pending' | 'failed'

interface StkPushParams {
  phoneNumber: string
  bookingId?: string
  purpose?: 'viewing_deposit' | 'listing_boost' | 'subscription' | 'rent'
  accountReference?: string
}

interface StkPushResult {
  checkoutRequestId?: string
  error?: string
}

export function useStkPush() {
  const [state, setState] = useState<StkPushState>('idle')
  const [error, setError] = useState<string | null>(null)

  async function initiateStkPush(params: StkPushParams): Promise<StkPushResult> {
    setState('sending')
    setError(null)
    try {
      if (!supabase) throw new Error('M-PESA payments need a connected Supabase project')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('You need to sign in first')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stk-push`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(params)
        }
      )

      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Payment could not be started')
      }

      setState('pending')
      return { checkoutRequestId: json.checkoutRequestId }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState('failed')
      setError(message)
      return { error: message }
    }
  }

  return { state, error, initiateStkPush }
}
