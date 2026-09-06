import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface InstanceTenantMapping {
  instanceName: string;
  tenantId: string;
  phoneNumber: string;
  status: 'active' | 'inactive' | 'error';
  webhookSecret: string;
}

export class InstanceTenantResolver {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  async resolveInstanceToTenant(instanceName: string): Promise<{ success: boolean; tenantId?: string; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_instances')
        .select('tenant_id, phone_number, status, webhook_secret')
        .eq('evolution_instance_name', instanceName)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        return { 
          success: false, 
          message: `Instance not found or inactive: ${instanceName}`
        };
      }

      return {
        success: true,
        tenantId: data.tenant_id,
        message: `Instance ${instanceName} resolved to tenant ${data.tenant_id}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error resolving instance: ${(error as Error).message}`
      };
    }
  }

  async getInstanceDetails(instanceName: string): Promise<{ success: boolean; instance?: InstanceTenantMapping; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_instances')
        .select('evolution_instance_name, tenant_id, phone_number, status, webhook_secret')
        .eq('evolution_instance_name', instanceName)
        .single();

      if (error || !data) {
        return { 
          success: false, 
          message: `Instance not found: ${instanceName}`
        };
      }

      return {
        success: true,
        instance: {
          instanceName: data.evolution_instance_name,
          tenantId: data.tenant_id,
          phoneNumber: data.phone_number,
          status: data.status as 'active' | 'inactive' | 'error',
          webhookSecret: data.webhook_secret
        },
        message: `Instance details retrieved for ${instanceName}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error retrieving instance details: ${(error as Error).message}`
      };
    }
  }

  async validateInstanceAccess(instanceName: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_instances')
        .select('tenant_id, status')
        .eq('evolution_instance_name', instanceName)
        .single();

      if (error || !data) {
        return { 
          success: false, 
          message: `Instance not found: ${instanceName}`
        };
      }

      if (data.tenant_id !== tenantId) {
        return { 
          success: false, 
          message: `Instance ${instanceName} does not belong to tenant ${tenantId}`
        };
      }

      if (data.status !== 'active') {
        return { 
          success: false, 
          message: `Instance ${instanceName} is not active (status: ${data.status})`
        };
      }

      return {
        success: true,
        message: `Instance ${instanceName} access validated for tenant ${tenantId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error validating instance access: ${(error as Error).message}`
      };
    }
  }

  async getAllActiveInstances(): Promise<{ success: boolean; instances?: InstanceTenantMapping[]; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_instances')
        .select('evolution_instance_name, tenant_id, phone_number, status, webhook_secret')
        .eq('status', 'active');

      if (error) {
        return { 
          success: false, 
          message: `Database error retrieving instances: ${error.message}`
        };
      }

      const instances = data?.map(item => ({
        instanceName: item.evolution_instance_name,
        tenantId: item.tenant_id,
        phoneNumber: item.phone_number,
        status: item.status as 'active' | 'inactive' | 'error',
        webhookSecret: item.webhook_secret
      })) || [];

      return {
        success: true,
        instances,
        message: `Retrieved ${instances.length} active instances`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error retrieving instances: ${(error as Error).message}`
      };
    }
  }

  async createInstanceMapping(
    instanceName: string,
    tenantId: string,
    phoneNumber: string,
    webhookSecret: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from('whatsapp_instances')
        .insert({
          evolution_instance_name: instanceName,
          tenant_id: tenantId,
          phone_number: phoneNumber,
          status: 'active',
          webhook_secret: webhookSecret
        });

      if (error) {
        return { 
          success: false, 
          message: `Failed to create instance mapping: ${error.message}`
        };
      }

      return {
        success: true,
        message: `Instance mapping created for ${instanceName} to tenant ${tenantId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error creating instance mapping: ${(error as Error).message}`
      };
    }
  }

  async deactivateInstance(instanceName: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from('whatsapp_instances')
        .update({ status: 'inactive' })
        .eq('evolution_instance_name', instanceName);

      if (error) {
        return { 
          success: false, 
          message: `Failed to deactivate instance: ${error.message}`
        };
      }

      return {
        success: true,
        message: `Instance ${instanceName} deactivated`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error deactivating instance: ${(error as Error).message}`
      };
    }
  }
}

// Export a singleton instance
export const instanceTenantResolver = new InstanceTenantResolver(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);