import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { AgentKyc } from '@/types/database'

const DEMO_KYC: AgentKyc[] = [
  {
    agentId: 'demo-agent',
    agentName: 'Amina Wanjiru',
    agentEmail: 'amina@demo.dimora',
    kraPin: 'A002345678K',
    idDocumentUrl:
      'https://images.pexels.com/photos/210617/pexels-photo-210617.jpeg?auto=compress&cs=tinysrgb&w=800',
    selfieUrl:
      'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800',
    status: 'pending',
    reviewedAt: null,
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
  }
]

interface UseAdminKycResult {
  rows: AgentKyc[]
  loading: boolean
  busyId: string | null
  error: string | null
  approve: (adminId: string, row: AgentKyc) => Promise<boolean>
  reject: (adminId: string, row: AgentKyc) => Promise<boolean>
}

export function useAdminKyc(): UseAdminKycResult {
  const [rows, setRows] = useState<AgentKyc[]>(DEMO_KYC)
  const [loading, setLoading] = useState(() => Boolean(supabase))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(Boolean(supabase))

    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('agent_kyc')
        .select(
          `agent_id, kra_pin, id_document_url, selfie_url, status, reviewed_at, created_at,
           agent:profiles!agent_kyc_agent_id_fkey(email, full_name)`
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (err) setError(err.message)
      setRows(
        (data ?? []).map((row) => ({
          agentId: row.agent_id,
          agentName: (row.agent as { full_name?: string | null } | null)?.full_name ?? 'Unknown agent',
          agentEmail: (row.agent as { email?: string | null } | null)?.email ?? null,
          kraPin: row.kra_pin ?? null,
          idDocumentUrl: row.id_document_url,
          selfieUrl: row.selfie_url,
          status: row.status ?? 'pending',
          reviewedAt: row.reviewed_at,
          createdAt: row.created_at ?? ''
        }))
      )
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function review(adminId: string, row: AgentKyc, status: 'approved' | 'rejected'): Promise<boolean> {
    setError(null)
    setBusyId(row.agentId)

    try {
      if (supabase) {
        const { error: err } = await supabase
          .from('agent_kyc')
          .update({ status, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
          .eq('agent_id', row.agentId)
          .eq('status', 'pending')
        if (err) throw new Error(err.message)

        if (status === 'approved') {
          const { error: roleError } = await supabase.from('profiles').update({ role: 'agent' }).eq('id', row.agentId)
          if (roleError) throw new Error(roleError.message)
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 400))
      }

      setRows((prev) => prev.filter((r) => r.agentId !== row.agentId))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed.')
      return false
    } finally {
      setBusyId(null)
    }
  }

  return {
    rows,
    loading,
    busyId,
    error,
    approve: async (adminId, row) => review(adminId, row, 'approved'),
    reject: async (adminId, row) => review(adminId, row, 'rejected')
  }
}