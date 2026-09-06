import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sessionManager } from "./sessionManager.ts";

export interface TenantConfig {
  agentName: string;
  businessName: string;
  businessType: string;
  marketRegion: string;
  catalogNoun: string;
  toneDescription: string;
  businessRules: string;
  defaultLanguage: string;
  outOfScopeTopics: string[];
  catalogSource: string;
  agentId: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tool_calls?: any[];
}

export interface ToolResult {
  tool_name: string;
  tool_args: Record<string, any>;
  result: any;
}

export interface AgentResponse {
  message: string;
  tool_calls?: ToolResult[];
  sessionId?: string;
}

export class AgentOrchestrator {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  async loadTenantConfig(tenantId: string): Promise<{ success: boolean; config?: TenantConfig; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return {
          success: false,
          message: `Database error loading tenant config: ${error.message}`
        };
      }

      if (!data) {
        return {
          success: false,
          message: `Tenant config not found for tenant ${tenantId}`
        };
      }

      return {
        success: true,
        config: data,
        message: `Tenant config loaded for ${tenantId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error loading tenant config: ${(error as Error).message}`
      };
    }
  }

  async generateSystemPrompt(config: TenantConfig): string {
    // Generate system prompt based on tenant configuration
    // This would typically be stored in the database or generated dynamically
    return `
# Role
You are ${config.agentName}, the WhatsApp conversational assistant for
${config.businessName}, a ${config.businessType} operating in ${config.marketRegion}.
You represent ${config.businessName} directly to its customers — you are not a
generic assistant, and you never claim to be a human unless the business
has explicitly configured you to.

# Task
Your job is to help the person messaging you accomplish one of these, in
order of priority:
1. Answer questions about ${config.businessName}'s ${config.catalogNoun} (e.g.
   listings, products, services, availability) using only the data you're
   given — never invent details you don't have.
2. Move a genuinely interested person toward a concrete next step:
   booking, scheduling, or a qualified handoff to a human team member.
3. Capture enough information (name, need, timeline) to create or update a
   useful lead record, even if the conversation doesn't convert immediately.
You are not trying to close every conversation yourself — recognizing when
to hand off to a human is part of doing the job well.

# Constraints
- Never fabricate availability, pricing, or catalog details
- Never impersonate a human team member
- Treat opt-out language as final for marketing-style messages
- Do not collect more personal information than required
- Keep replies short and mobile-friendly
- Respond in the language the contact is using
- If a conversation has been flagged handoff_to_human, stop generating
  new substantive replies
- Stay within ${config.businessName}'s configured scope (${config.outOfScopeTopics})

# Output
Produce exactly one WhatsApp-ready reply per turn:
- Plain text, conversational, sized for a chat bubble
- Any tool calls needed for this turn, issued before the reply is
  considered final
- No markdown headers, no code blocks
- If handing off, the visible reply should set expectations plainly
    `;
  }

  async processMessage(
    tenantId: string,
    contactPhone: string,
    threadId: string,
    userMessage: string,
    sessionState?: Record<string, any>
  ): Promise<{ success: boolean; response?: AgentResponse; message: string }> {
    try {
      // Load or create session
      const sessionResult = await sessionManager.loadOrCreateSession(
        tenantId,
        contactPhone,
        threadId
      );

      if (!sessionResult.success) {
        return {
          success: false,
          message: `Failed to load/create session: ${sessionResult.message}`
        };
      }

      const session = sessionResult.session!;

      // Load tenant config
      const configResult = await this.loadTenantConfig(tenantId);

      if (!configResult.success) {
        return {
          success: false,
          message: `Failed to load tenant config: ${configResult.message}`
        };
      }

      const config = configResult.config!;

      // Generate system prompt
      const systemPrompt = this.generateSystemPrompt(config);

      // Get recent conversation history for context
      const { data: recentMessages, error: messagesError } = await this.supabase
        .from('messages_log')
        .select('payload, direction')
        .eq('tenant_id', tenantId)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (messagesError) {
        return {
          success: false,
          message: `Failed to retrieve conversation history: ${messagesError.message}`
        };
      }

      // Prepare messages for LLM call
      const messages: AgentMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(sessionState ? [{ role: 'system' as const, content: `Current session state: ${JSON.stringify(sessionState)}` }] : []),
        ...((recentMessages || []).slice().reverse().map(msg => ({
          role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)
        }))),
        { role: 'user', content: userMessage }
      ];

      // TODO: Integrate with actual LLM provider here
      // For now, return a basic response
      const basicResponse: AgentResponse = {
        message: `I understand you're interested in ${config.businessName}. Let me help you with that. Could you tell me more about what you're looking for?`,
        sessionId: session.id
      };

      // Update session state
      const updatedState = {
        ...sessionState,
        last_user_message: userMessage,
        last_assistant_response: basicResponse.message,
        timestamp: new Date().toISOString()
      };

      await sessionManager.updateSessionState(session.id, updatedState);

      return {
        success: true,
        response: basicResponse,
        message: `Message processed successfully for ${contactPhone}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error processing message: ${(error as Error).message}`
      };
    }
  }

  async executeToolCall(
    toolName: string,
    toolArgs: Record<string, any>,
    tenantId: string
  ): Promise<{ success: boolean; result?: any; message: string }> {
    try {
      // This would call the actual tool implementation
      // For now, return a placeholder response
      console.log(`Executing tool: ${toolName} with args:`, toolArgs);

      // Example tool implementations (would be expanded based on actual tool definitions)
      switch (toolName) {
        case 'lookup_catalog':
          const { data: catalogItems, error: catalogError } = await this.supabase
            .from('properties')
            .select('id, title, price, type, bedrooms, bathrooms, neighborhood')
            .eq('agent_id', tenantId)
            .eq('is_published', true)
            .eq('deleted_at', null)
            .limit(10);

          if (catalogError) {
            throw new Error(`Catalog lookup failed: ${catalogError.message}`);
          }

          return {
            success: true,
            result: catalogItems,
            message: `Found ${catalogItems?.length || 0} catalog items`
          };

        case 'check_availability':
          const { data: bookings, error: bookingsError } = await this.supabase
            .from('bookings')
            .select('scheduled_at, status')
            .eq('agent_id', tenantId)
            .eq('status', 'confirmed')
            .gte('scheduled_at', toolArgs.date || new Date().toISOString());

          if (bookingsError) {
            throw new Error(`Availability check failed: ${bookingsError.message}`);
          }

          return {
            success: true,
            result: { available_slots: bookings?.length || 0 },
            message: `Found ${bookings?.length || 0} available slots`
          };

        case 'create_or_update_lead':
          const leadData = {
            tenant_id: tenantId,
            lead_source: 'whatsapp',
            thread_id: toolArgs.threadId,
            contact_phone: toolArgs.contactPhone,
            status: 'new',
            assigned_to: toolArgs.assignedTo,
            notes: toolArgs.notes || ''
          };

          const { data: lead, error: leadError } = await this.supabase
            .from('leads')
            .upsert(leadData, {
              onConflict: 'thread_id',
              merge: true
            })
            .select()
            .single();

          if (leadError) {
            throw new Error(`Lead creation failed: ${leadError.message}`);
          }

          return {
            success: true,
            result: lead,
            message: `Lead created/updated successfully`
          };

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        success: false,
        message: `Tool execution failed: ${(error as Error).message}`
      };
    }
  }
}

// Export a singleton instance
export const agentOrchestrator = new AgentOrchestrator(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);