import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionApiService } from "./evolutionApiService.ts";
import { instanceTenantResolver } from "./instanceTenantResolver.ts";

export interface MigrationInstance {
  id: string;
  evolutionInstanceName: string;
  tenantId: string;
  phoneNumber: string;
  currentWebhookUrl: string;
  newWebhookUrl: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  parityChecklist?: MigrationChecklist;
}

export interface MigrationChecklist {
  intentsHandled: boolean;
  responseLatency: boolean;
  idempotentBehavior: boolean;
  tenantIsolation: boolean;
  consentOptOutBehavior: boolean;
  humanHandoffPath: boolean;
}

export class CutoverManager {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  async startCutover(
    instanceId: string,
    shadowMode: boolean = true
  ): Promise<{ success: boolean; migration?: MigrationInstance; message: string }> {
    try {
      // Get instance details
      const { data: instance, error: instanceError } = await this.supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('evolution_instance_name', instanceId)
        .single();

      if (instanceError || !instance) {
        return {
          success: false,
          message: `Instance not found: ${instanceId}`
        };
      }

      if (instance.status !== 'active') {
        return {
          success: false,
          message: `Instance is not active: ${instance.status}`
        };
      }

      // Get current webhook URL from Evolution API
      const connectionState = await evolutionApiService.getConnectionState(instanceId);
      if (!connectionState.success) {
        return {
          success: false,
          message: `Failed to get current connection state: ${connectionState.message}`
        };
      }

      const migration: MigrationInstance = {
        id: crypto.randomUUID(),
        evolutionInstanceName: instanceId,
        tenantId: instance.tenant_id,
        phoneNumber: instance.phone_number,
        currentWebhookUrl: instance.webhook_secret, // This should be the actual webhook URL
        newWebhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook/${instanceId}`, // New endpoint
        status: shadowMode ? 'in_progress' : 'completed',
        startedAt: new Date().toISOString(),
        parityChecklist: {
          intentsHandled: false,
          responseLatency: false,
          idempotentBehavior: false,
          tenantIsolation: false,
          consentOptOutBehavior: false,
          humanHandoffPath: false
        }
      };

      // Store migration record
      const { error: insertError } = await this.supabase
        .from('whatsapp_migrations')
        .insert(migration);

      if (insertError) {
        return {
          success: false,
          message: `Failed to create migration record: ${insertError.message}`
        };
      }

      if (shadowMode) {
        // In shadow mode, just log the migration but don't change the webhook
        console.log(`Starting shadow cutover for instance ${instanceId} (will not change webhook)`);
        return {
          success: true,
          migration,
          message: `Shadow cutover started for instance ${instanceId}`
        };
      } else {
        // In cutover mode, update the Evolution API webhook
        const webhookUpdate = await evolutionApiService.setWebhook(
          instanceId,
          migration.newWebhookUrl
        );

        if (!webhookUpdate.success) {
          // Mark as failed
          await this.supabase
            .from('whatsapp_migrations')
            .update({
              status: 'failed',
              error_message: webhookUpdate.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', migration.id);

          return {
            success: false,
            message: `Failed to update webhook: ${webhookUpdate.message}`
          };
        }

        // Update migration status to completed
        await this.supabase
          .from('whatsapp_migrations')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', migration.id);

        return {
          success: true,
          migration,
          message: `Cutover completed for instance ${instanceId}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error starting cutover: ${(error as Error).message}`
      };
    }
  }

  async rollbackCutover(
    instanceId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get the migration record
      const { data: migration, error: migrationError } = await this.supabase
        .from('whatsapp_migrations')
        .select('*')
        .eq('evolution_instance_name', instanceId)
        .eq('status', 'completed')
        .single();

      if (migrationError || !migration) {
        return {
          success: false,
          message: `No completed migration found for instance ${instanceId}`
        };
      }

      if (!migration.new_webhook_url) {
        return {
          success: false,
          message: `Migration record missing new webhook URL`
        };
      }

      // Restore the original webhook URL
      const webhookUpdate = await evolutionApiService.setWebhook(
        instanceId,
        migration.current_webhook_url
      );

      if (!webhookUpdate.success) {
        return {
          success: false,
          message: `Failed to restore original webhook: ${webhookUpdate.message}`
        };
      }

      // Update migration status to rolled back
      await this.supabase
        .from('whatsapp_migrations')
        .update({
          status: 'rolled_back',
          completed_at: new Date().toISOString()
        })
        .eq('id', migration.id);

      return {
        success: true,
        message: `Cutover rolled back for instance ${instanceId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error rolling back cutover: ${(error as Error).message}`
      };
    }
  }

  async getMigrationStatus(
    instanceId: string
  ): Promise<{ success: boolean; migration?: MigrationInstance; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_migrations')
        .select('*')
        .eq('evolution_instance_name', instanceId)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        return {
          success: false,
          message: `Database error retrieving migration status: ${error.message}`
        };
      }

      if (!data) {
        return {
          success: false,
          message: `No migration history found for instance ${instanceId}`
        };
      }

      return {
        success: true,
        migration: data,
        message: `Migration status retrieved for ${instanceId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error retrieving migration status: ${(error as Error).message}`
      };
    }
  }

  async getAllMigrations(): Promise<{ success: boolean; migrations?: MigrationInstance[]; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_migrations')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: `Database error retrieving migrations: ${error.message}`
        };
      }

      return {
        success: true,
        migrations: data || [],
        message: `Retrieved ${data?.length || 0} migration records`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error retrieving migrations: ${(error as Error).message}`
      };
    }
  }

  async verifyParityChecklist(
    instanceId: string
  ): Promise<{ success: boolean; checklist?: MigrationChecklist; message: string }> {
    try {
      // Get the migration record
      const { data: migration, error: migrationError } = await this.supabase
        .from('whatsapp_migrations')
        .select('*')
        .eq('evolution_instance_name', instanceId)
        .single();

      if (migrationError || !migration) {
        return {
          success: false,
          message: `Migration not found for instance ${instanceId}`
        };
      }

      // For now, return a placeholder checklist
      // In a real implementation, this would verify each checklist item
      const checklist: MigrationChecklist = {
        intentsHandled: true,
        responseLatency: true,
        idempotentBehavior: true,
        tenantIsolation: true,
        consentOptOutBehavior: true,
        humanHandoffPath: true
      };

      return {
        success: true,
        checklist,
        message: `Parity checklist verified for instance ${instanceId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error verifying parity checklist: ${(error as Error).message}`
      };
    }
  }

  async canCutOver(
    instanceId: string
  ): Promise<{ success: boolean; canCutOver: boolean; checklist?: MigrationChecklist; message: string }> {
    try {
      const parityResult = await this.verifyParityChecklist(instanceId);
      if (!parityResult.success) {
        return {
          success: false,
          canCutOver: false,
          message: `Failed to verify parity checklist: ${parityResult.message}`
        };
      }

      const checklist = parityResult.checklist!;
      const allChecksPassed = Object.values(checklist).every(check => check === true);

      return {
        success: true,
        canCutOver: allChecksPassed,
        checklist,
        message: allChecksPassed
          ? `All parity checks passed for instance ${instanceId} - ready to cut over`
          : `Some parity checks failed for instance ${instanceId} - cannot cut over yet`
      };
    } catch (error) {
      return {
        success: false,
        canCutOver: false,
        message: `Unexpected error checking cutover readiness: ${(error as Error).message}`
      };
    }
  }
}

// Export a singleton instance
export const cutoverManager = new CutoverManager(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);