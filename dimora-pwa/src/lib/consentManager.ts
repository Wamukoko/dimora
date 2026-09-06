import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ConsentRecord {
  id: string;
  tenantId: string;
  contactPhone: string;
  consentType: 'marketing' | 'sms' | 'email' | 'phone';
  grantedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export class ConsentManager {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  async checkConsent(
    tenantId: string,
    contactPhone: string,
    consentType: 'marketing' | 'sms' | 'email' | 'phone' = 'marketing'
  ): Promise<{ hasConsent: boolean; record?: ConsentRecord; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('consent_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_phone', contactPhone)
        .eq('consent_type', consentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        return {
          hasConsent: false,
          message: `Database error checking consent: ${error.message}`
        };
      }

      if (!data) {
        return {
          hasConsent: false,
          message: `No consent record found for ${contactPhone}`
        };
      }

      // Check if consent is currently active (granted but not revoked)
      const isCurrentlyActive = data.granted_at && !data.revoked_at;

      return {
        hasConsent: isCurrentlyActive,
        record: data,
        message: `Consent check for ${contactPhone}: ${isCurrentlyActive ? 'GRANTED' : 'NOT GRANTED'}`
      };
    } catch (error) {
      return {
        hasConsent: false,
        message: `Unexpected error checking consent: ${(error as Error).message}`
      };
    }
  }

  async logConsent(
    tenantId: string,
    contactPhone: string,
    consentType: 'marketing' | 'sms' | 'email' | 'phone',
    granted: boolean,
    timestamp?: string
  ): Promise<{ success: boolean; record?: ConsentRecord; message: string }> {
    try {
      const consentData = {
        tenant_id: tenantId,
        contact_phone: contactPhone,
        consent_type: consentType,
        granted_at: granted ? (timestamp || new Date().toISOString()) : null,
        revoked_at: granted ? null : (timestamp || new Date().toISOString()),
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('consent_log')
        .insert(consentData)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          message: `Failed to log consent: ${error.message}`
        };
      }

      return {
        success: true,
        record: data,
        message: `Consent ${consentType} ${granted ? 'granted' : 'revoked'} for ${contactPhone}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error logging consent: ${(error as Error).message}`
      };
    }
  }

  async detectOptOutKeywords(message: string): Promise<{ optOutDetected: boolean; type?: string; confidence: number }> {
    const lowerMessage = message.toLowerCase();
    
    // Common opt-out keywords and phrases
    const optOutPatterns = [
      { pattern: /stop\b/, type: 'STOP', confidence: 1.0 },
      { pattern: /unsubscribe\b/, type: 'UNSUBSCRIBE', confidence: 1.0 },
      { pattern: /opt[- ]?out\b/, type: 'OPT_OUT', confidence: 0.9 },
      { pattern: /remove\b/, type: 'REMOVE', confidence: 0.8 },
      { pattern: /cancel\b/, type: 'CANCEL', confidence: 0.8 },
      { pattern: /no more\b/, type: 'NO_MORE', confidence: 0.7 },
      { pattern: /don\'t\s*send\b/, type: 'DON_T_SEND', confidence: 0.8 },
      { pattern: /quit\b/, type: 'QUIT', confidence: 0.7 },
      { pattern: /leave\b/, type: 'LEAVE', confidence: 0.7 }
    ];

    for (const { pattern, type, confidence } of optOutPatterns) {
      if (pattern.test(lowerMessage)) {
        return {
          optOutDetected: true,
          type,
          confidence
        };
      }
    }

    return {
      optOutDetected: false,
      confidence: 0
    };
  }

  async handleOptOut(
    tenantId: string,
    contactPhone: string,
    optOutType: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Log the opt-out to consent_log
      const consentResult = await this.logConsent(
        tenantId,
        contactPhone,
        'marketing',
        false, // revoked
        new Date().toISOString()
      );

      if (!consentResult.success) {
        return {
          success: false,
          message: `Failed to log opt-out: ${consentResult.message}`
        };
      }

      // Log the opt-out event for audit purposes
      const { error: auditError } = await this.supabase
        .from('listing_events')
        .insert({
          property_id: null, // No property associated with this opt-out
          event_type: 'whatsapp_opt_out',
          created_at: new Date().toISOString()
        });

      if (auditError) {
        console.warn('Failed to log opt-out audit event:', auditError.message);
      }

      return {
        success: true,
        message: `Opt-out recorded for ${contactPhone}: ${optOutType}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error handling opt-out: ${(error as Error).message}`
      };
    }
  }

  async isOptedOut(
    tenantId: string,
    contactPhone: string
  ): Promise<{ isOptedOut: boolean; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('consent_log')
        .select('granted_at, revoked_at, consent_type')
        .eq('tenant_id', tenantId)
        .eq('contact_phone', contactPhone)
        .eq('consent_type', 'marketing')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        return {
          isOptedOut: false,
          message: `Database error checking opt-out status: ${error.message}`
        };
      }

      if (!data) {
        return {
          isOptedOut: false,
          message: `No opt-out record found for ${contactPhone}`
        };
      }

      const isCurrentlyOptedOut = data.granted_at && !data.revoked_at;

      return {
        isOptedOut: isCurrentlyOptedOut,
        message: `Opt-out status for ${contactPhone}: ${isCurrentlyOptedOut ? 'OPTED_OUT' : 'NOT_OPTED_OUT'}`
      };
    } catch (error) {
      return {
        isOptedOut: false,
        message: `Unexpected error checking opt-out status: ${(error as Error).message}`
      };
    }
  }

  async getConsentHistory(
    tenantId: string,
    contactPhone: string
  ): Promise<{ success: boolean; history?: ConsentRecord[]; message: string }> {
    try {
      const { data, error } = await this.supabase
        .from('consent_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_phone', contactPhone)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: `Failed to retrieve consent history: ${error.message}`
        };
      }

      return {
        success: true,
        history: data || [],
        message: `Retrieved ${data?.length || 0} consent records for ${contactPhone}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error retrieving consent history: ${(error as Error).message}`
      };
    }
  }
}

// Export a singleton instance
export const consentManager = new ConsentManager(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);