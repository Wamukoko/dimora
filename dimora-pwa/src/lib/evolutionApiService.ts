import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface EvolutionInstance {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'active' | 'inactive' | 'error';
  webhookSecret: string;
  apiKey: string;
  baseUrl: string;
  tenantId: string;
}

export interface EvolutionMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: number;
  type: 'text' | 'media' | 'interactive';
}

export interface EvolutionApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

export class EvolutionApiService {
  private supabase;
  private baseUrl: string;
  private apiKey: string;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    this.baseUrl = Deno.env.get('SUPABASE_URL') || '';
    this.apiKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  }

  async createInstance(instanceData: Partial<EvolutionInstance>): Promise<EvolutionApiResponse> {
    try {
      // First, get the tenant's Evolution API credentials from whatsapp_instances
      const { data: tenantInstance, error: fetchError } = await this.supabase
        .from('whatsapp_instances')
        .select('evolution_instance_name, evolution_api_key, evolution_base_url')
        .eq('tenant_id', instanceData.tenantId)
        .eq('status', 'active')
        .single();

      if (fetchError || !tenantInstance) {
        return { success: false, message: 'Tenant Evolution API instance not found' };
      }

      // Make API call to Evolution
      const response = await fetch(`${tenantInstance.evolution_base_url}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tenantInstance.evolution_api_key}`
        },
        body: JSON.stringify({
          name: instanceData.name,
          owner: instanceData.phoneNumber,
          profileName: instanceData.name,
          webhook: {
            url: `${this.baseUrl}/functions/v1/whatsapp-webhook/${tenantInstance.evolution_instance_name}`,
            byEvents: ['messages.upsert'],
            base64: false
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, message: `Evolution API error: ${errorText}` };
      }

      const result = await response.json();

      // Store the instance in our database
      const { data, error } = await this.supabase
        .from('whatsapp_instances')\n        .insert({
          tenant_id: instanceData.tenantId,
          evolution_instance_name: instanceData.name,
          phone_number: instanceData.phoneNumber,
          status: 'active',
          webhook_secret: crypto.randomUUID(),
          evolution_api_key: tenantInstance.evolution_api_key,
          evolution_base_url: tenantInstance.evolution_base_url
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: `Database error: ${error.message}` };
      }

      return { success: true, message: 'Evolution API instance created successfully', data };
    } catch (error) {
      return { success: false, message: `Unexpected error: ${(error as Error).message}` };
    }
  }

  async getConnectionState(instanceName: string): Promise<EvolutionApiResponse> {
    try {
      const { data: tenantInstance, error: fetchError } = await this.supabase
        .from('whatsapp_instances')
        .select('evolution_instance_name, evolution_api_key, evolution_base_url')
        .eq('evolution_instance_name', instanceName)
        .eq('status', 'active')
        .single();

      if (fetchError || !tenantInstance) {
        return { success: false, message: 'Evolution API instance not found' };
      }

      const response = await fetch(`${tenantInstance.evolution_base_url}/instance/connection-state/${tenantInstance.evolution_instance_name}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tenantInstance.evolution_api_key}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, message: `Evolution API error: ${errorText}` };
      }

      const result = await response.json();
      return { success: true, message: 'Connection state retrieved', data: result };
    } catch (error) {
      return { success: false, message: `Unexpected error: ${(error as Error).message}` };
    }
  }

  async sendText(instanceName: string, messageData: { to: string; message: string }): Promise<EvolutionApiResponse> {
    try {
      const { data: tenantInstance, error: fetchError } = await this.supabase
        .from('whatsapp_instances')
        .select('evolution_instance_name, evolution_api_key, evolution_base_url')
        .eq('evolution_instance_name', instanceName)
        .eq('status', 'active')
        .single();

      if (fetchError || !tenantInstance) {
        return { success: false, message: 'Evolution API instance not found' };
      }

      const response = await fetch(`${tenantInstance.evolution_base_url}/message/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tenantInstance.evolution_api_key}`
        },
        body: JSON.stringify({
          instanceName: tenantInstance.evolution_instance_name,
          to: messageData.to,
          message: messageData.message
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, message: `Evolution API error: ${errorText}` };
      }

      const result = await response.json();
      return { success: true, message: 'Message sent successfully', data: result };
    } catch (error) {
      return { success: false, message: `Unexpected error: ${(error as Error).message}` };
    }
  }

  async sendMedia(instanceName: string, messageData: {
    to: string;
    caption: string;
    media: string;
    mimetype: string;
  }): Promise<EvolutionApiResponse> {
    try {
      const { data: tenantInstance, error: fetchError } = await this.supabase
        .from('whatsapp_instances')
        .select('evolution_instance_name, evolution_api_key, evolution_base_url')
        .eq('evolution_instance_name', instanceName)
        .eq('status', 'active')
        .single();

      if (fetchError || !tenantInstance) {
        return { success: false, message: 'Evolution API instance not found' };
      }

      const response = await fetch(`${tenantInstance.evolution_base_url}/message/sendMedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tenantInstance.evolution_api_key}`
        },
        body: JSON.stringify({
          instanceName: tenantInstance.evolution_instance_name,
          to: messageData.to,
          caption: messageData.caption,
          media: messageData.media,
          mimetype: messageData.mimetype
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, message: `Evolution API error: ${errorText}` };
      }

      const result = await response.json();
      return { success: true, message: 'Media sent successfully', data: result };
    } catch (error) {
      return { success: false, message: `Unexpected error: ${(error as Error).message}` };
    }
  }

  async setWebhook(instanceName: string, webhookUrl: string): Promise<EvolutionApiResponse> {
    try {
      const { data: tenantInstance, error: fetchError } = await this.supabase
        .from('whatsapp_instances')
        .select('evolution_instance_name, evolution_api_key, evolution_base_url')
        .eq('evolution_instance_name', instanceName)
        .eq('status', 'active')
        .single();

      if (fetchError || !tenantInstance) {
        return { success: false, message: 'Evolution API instance not found' };
      }

      const response = await fetch(`${tenantInstance.evolution_base_url}/webhook/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tenantInstance.evolution_api_key}`
        },
        body: JSON.stringify({
          instanceName: tenantInstance.evolution_instance_name,
          webhook: {
            url: webhookUrl,
            byEvents: ['messages.upsert'],
            base64: false
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, message: `Evolution API error: ${errorText}` };
      }

      const result = await response.json();
      return { success: true, message: 'Webhook set successfully', data: result };
    } catch (error) {
      return { success: false, message: `Unexpected error: ${(error as Error).message}` };
    }
  }

  async resolveInstanceToTenant(instanceName: string): Promise<{ success: boolean; tenantId?: string; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_instances')
        .select('tenant_id')
        .eq('evolution_instance_name', instanceName)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        return { success: false, message: 'Instance not found or inactive' };
      }

      return { success: true, tenantId: data.tenant_id, message: 'Instance resolved successfully' };
    } catch (error) {
      return { success: false, message: `Unexpected error: ${(error as Error).message}` };
    }
  }

  async logWebhookMessage(messageData: {
    tenantId: string;
    threadId: string;
    evolutionMessageId: string;
    direction: 'inbound' | 'outbound';
    payload: any;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from('messages_log')
        .insert({
          tenant_id: messageData.tenantId,
          thread_id: messageData.threadId,
          evolution_message_id: messageData.evolutionMessageId,
          direction: messageData.direction,
          payload: messageData.payload
        });

      if (error) {
        return { success: false, message: `Failed to log webhook message: ${error.message}` };
      }

      return { success: true, message: 'Webhook message logged successfully' };
    } catch (error) {
      return { success: false, message: `Unexpected error: ${(error as Error).message}` };
    }
  }

  async checkWebhookIdempotency(evolutionMessageId: string): Promise<{ success: boolean; canProcess: boolean; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('messages_log')
        .select('evolution_message_id')
        .eq('evolution_message_id', evolutionMessageId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return { success: false, canProcess: false, message: `Database error: ${error.message}` };
      }

      if (data) {
        return { success: true, canProcess: false, message: 'Webhook already processed (idempotent)' };
      }

      return { success: true, canProcess: true, message: 'Webhook can be processed' };
    } catch (error) {
      return { success: false, canProcess: false, message: `Unexpected error: ${(error as Error).message}` };
    }
  }
}

// Export a singleton instance
export const evolutionApiService = new EvolutionApiService(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);