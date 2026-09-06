import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ConversationSession {
  id: string;
  tenantId: string;
  contactPhone: string;
  threadId: string;
  state: Record<string, any>;
  lastMessageAt: string;
  handoffToHuman: boolean;
  createdAt: string;
  updatedAt: string;
}

export class SessionManager {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  async loadOrCreateSession(
    tenantId: string,
    contactPhone: string,
    threadId: string
  ): Promise<{ success: boolean; session?: ConversationSession; message: string }> {
    try {
      // First, try to load existing session
      const { data: existingSession, error: fetchError } = await this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_phone', contactPhone)
        .eq('thread_id', threadId)
        .single();

      if (existingSession) {
        return {
          success: true,
          session: existingSession,
          message: `Loaded existing session for ${contactPhone}`
        };
      }

      if (fetchError && fetchError.code !== 'PGRST116') {
        return {
          success: false,
          message: `Database error loading session: ${fetchError.message}`
        };
      }

      // Create new session
      const newSession: Partial<ConversationSession> = {
        tenant_id: tenantId,
        contact_phone: contactPhone,
        thread_id: threadId,
        state: {},
        last_message_at: new Date().toISOString(),
        handoff_to_human: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdSession, error: insertError } = await this.supabase
        .from('conversation_sessions')
        .insert(newSession)
        .select()
        .single();

      if (insertError) {
        return {
          success: false,
          message: `Failed to create session: ${insertError.message}`
        };
      }

      return {
        success: true,
        session: createdSession,
        message: `Created new session for ${contactPhone}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error managing session: ${(error as Error).message}`
      };
    }
  }

  async updateSessionState(
    sessionId: string,
    stateUpdate: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from('conversation_sessions')
        .update({
          state: { ...stateUpdate },
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        return {
          success: false,
          message: `Failed to update session state: ${error.message}`
        };
      }

      return {
        success: true,
        message: `Session ${sessionId} state updated`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error updating session state: ${(error as Error).message}`
      };
    }
  }

  async setHandoffToHuman(
    sessionId: string,
    handoff: boolean
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from('conversation_sessions')
        .update({
          handoff_to_human: handoff,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        return {
          success: false,
          message: `Failed to update handoff status: ${error.message}`
        };
      }

      return {
        success: true,
        message: `Session ${sessionId} handoff status updated to ${handoff}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error updating handoff status: ${(error as Error).message}`
      };
    }
  }

  async getSession(sessionId: string): Promise<{ success: boolean; session?: ConversationSession; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return {
          success: false,
          message: `Database error retrieving session: ${error.message}`
        };
      }

      if (!data) {
        return {
          success: false,
          message: `Session not found: ${sessionId}`
        };
      }

      return {
        success: true,
        session: data,
        message: `Session ${sessionId} retrieved`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error retrieving session: ${(error as Error).message}`
      };
    }
  }

  async getAllSessionsForTenant(
    tenantId: string
  ): Promise<{ success: boolean; sessions?: ConversationSession[]; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_message_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: `Database error retrieving sessions: ${error.message}`
        };
      }

      return {
        success: true,
        sessions: data || [],
        message: `Retrieved ${data?.length || 0} sessions for tenant ${tenantId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error retrieving sessions: ${(error as Error).message}`
      };
    }
  }

  async cleanupOldSessions(
    tenantId: string,
    olderThanDays: number = 30
  ): Promise<{ success: boolean; message: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { error } = await this.supabase
        .from('conversation_sessions')
        .delete()
        .eq('tenant_id', tenantId)
        .lt('last_message_at', cutoffDate.toISOString());

      if (error) {
        return {
          success: false,
          message: `Failed to cleanup old sessions: ${error.message}`
        };
      }

      return {
        success: true,
        message: `Cleaned up old sessions for tenant ${tenantId} (older than ${olderThanDays} days)`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error cleaning up sessions: ${(error as Error).message}`
      };
    }
  }
}

// Export a singleton instance
export const sessionManager = new SessionManager(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);