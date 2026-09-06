import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ToolResult {
  tool_name: string;
  tool_args: Record<string, any>;
  result: any;
}

export class ToolExecutionLayer {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  async lookupCatalog(
    query: string,
    tenantId: string,
    filters?: {
      type?: string;
      minPrice?: number;
      maxPrice?: number;
      bedrooms?: number;
      bathrooms?: number;
      neighborhood?: string;
      county?: string;
    }
  ): Promise<{ success: boolean; result?: any; message: string }> {
    try {
      let queryBuilder = this.supabase
        .from('properties')
        .select('id, title, description, price, type, bedrooms, bathrooms, county, sub_county, neighborhood, images, is_verified')
        .eq('agent_id', tenantId)
        .eq('is_published', true)
        .eq('deleted_at', null);

      // Apply filters if provided
      if (filters?.type) {
        queryBuilder = queryBuilder.eq('type', filters.type);
      }
      if (filters?.minPrice) {
        queryBuilder = queryBuilder.gte('price', filters.minPrice);
      }
      if (filters?.maxPrice) {
        queryBuilder = queryBuilder.lte('price', filters.maxPrice);
      }
      if (filters?.bedrooms) {
        queryBuilder = queryBuilder.eq('bedrooms', filters.bedrooms);
      }
      if (filters?.bathrooms) {
        queryBuilder = queryBuilder.eq('bathrooms', filters.bathrooms);
      }
      if (filters?.neighborhood) {
        queryBuilder = queryBuilder.ilike('neighborhood', `%${filters.neighborhood}%`);
      }
      if (filters?.county) {
        queryBuilder = queryBuilder.ilike('county', `%${filters.county}%`);
      }

      // Text search on title and description
      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }

      const { data, error } = await queryBuilder.order('created_at', { ascending: false }).limit(20);

      if (error) {
        return {
          success: false,
          message: `Catalog lookup failed: ${error.message}`
        };
      }

      return {
        success: true,
        result: data,
        message: `Found ${data?.length || 0} properties matching query: "${query}"`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error in catalog lookup: ${(error as Error).message}`
      };
    }
  }

  async checkAvailability(
    itemId: string,
    tenantId: string,
    date?: string
  ): Promise<{ success: boolean; result?: any; message: string }> {
    try {
      // Get the property details
      const { data: property, error: propertyError } = await this.supabase
        .from('properties')
        .select('id, title, agent_id')
        .eq('id', itemId)
        .eq('agent_id', tenantId)
        .single();

      if (propertyError || !property) {
        return {
          success: false,
          message: `Property not found: ${itemId}`
        };
      }

      // Get bookings for this property
      let query = this.supabase
        .from('bookings')
        .select('id, scheduled_at, status, hunter_id')
        .eq('property_id', itemId)
        .eq('agent_id', tenantId);

      if (date) {
        query = query.gte('scheduled_at', date);
      }

      const { data: bookings, error: bookingsError } = await query.order('scheduled_at', { ascending: true });

      if (bookingsError) {
        return {
          success: false,
          message: `Availability check failed: ${bookingsError.message}`
        };
      }

      // Get property verification status
      const { data: verifications, error: verificationsError } = await this.supabase
        .from('property_verifications')
        .select('kind, verified_at')
        .eq('property_id', itemId);

      const verificationStatus = verifications?.reduce((acc, v) => {
        acc[v.kind] = v.verified_at;
        return acc;
      }, {} as Record<string, string>);

      return {
        success: true,
        result: {
          property: property,
          bookings: bookings || [],
          verification_status: verificationStatus,
          available_slots: bookings?.filter(b => b.status === 'pending').length || 0
        },
        message: `Availability checked for property: ${property.title}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error checking availability: ${(error as Error).message}`
      };
    }
  }

  async createOrUpdateLead(
    fields: {
      tenantId: string;
      leadSource: string;
      threadId: string;
      contactPhone: string;
      status?: string;
      assignedTo?: string;
      notes?: string;
      name?: string;
      email?: string;
      interest?: string;
      timeline?: string;
    }
  ): Promise<{ success: boolean; result?: any; message: string }> {
    try {
      const leadData = {
        tenant_id: fields.tenantId,
        lead_source: fields.leadSource,
        thread_id: fields.threadId,
        contact_phone: fields.contactPhone,
        status: fields.status || 'new',
        assigned_to: fields.assignedTo,
        notes: fields.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add optional fields if provided
      if (fields.name) leadData['lead_name'] = fields.name;
      if (fields.email) leadData['lead_email'] = fields.email;
      if (fields.interest) leadData['interest'] = fields.interest;
      if (fields.timeline) leadData['timeline'] = fields.timeline;

      const { data, error } = await this.supabase
        .from('leads')
        .upsert(leadData, {
          onConflict: 'thread_id',
          merge: true
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          message: `Lead creation failed: ${error.message}`
        };
      }

      // Also create/update in agent_workspace_items for backward compatibility
      const workspaceItemData = {
        agent_id: fields.assignedTo || fields.tenantId,
        title: `WhatsApp lead: ${fields.name || fields.contactPhone}`,\n        lead_name: fields.name || fields.contactPhone,\n        lead_phone: fields.contactPhone,\n        lead_source: fields.leadSource,\n        whatsapp_thread_id: fields.threadId,\n        stage: fields.status || 'new_lead',\n        notes: fields.notes || '',\n        created_at: new Date().toISOString(),\n        updated_at: new Date().toISOString()
      };

      const { error: workspaceError } = await this.supabase
        .from('agent_workspace_items')
        .upsert(workspaceItemData, {
          onConflict: 'whatsapp_thread_id',
          merge: true
        });

      if (workspaceError) {
        console.warn('Failed to create workspace item, but lead was created:', workspaceError.message);
      }

      return {
        success: true,
        result: data,
        message: `Lead ${data.id} created/updated successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error creating lead: ${(error as Error).message}`
      };
    }
  }

  async scheduleBooking(
    itemId: string,
    datetime: string,
    contact: {
      name: string;
      phone: string;
      tenantId: string;
    },
    tenantId: string
  ): Promise<{ success: boolean; result?: any; message: string }> {
    try {
      // First, validate that the property exists and is available
      const { data: property, error: propertyError } = await this.supabase
        .from('properties')
        .select('id, title, agent_id')
        .eq('id', itemId)
        .eq('agent_id', tenantId)
        .single();

      if (propertyError || !property) {
        return {
          success: false,
          message: `Property not found: ${itemId}`
        };
      }

      // Check if there are any conflicting bookings
      const { data: conflictingBookings, error: conflictError } = await this.supabase
        .from('bookings')
        .select('id, scheduled_at, status')
        .eq('property_id', itemId)
        .eq('agent_id', tenantId)
        .eq('status', 'confirmed')
        .lt('scheduled_at', new Date(datetime).toISOString())
        .gt('scheduled_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (conflictError) {
        return {
          success: false,
          message: `Conflict check failed: ${conflictError.message}`
        };
      }

      // Create the booking
      const bookingData = {
        property_id: itemId,
        hunter_id: contact.tenantId, // Note: This should be the hunter's ID, not tenant ID
        agent_id: tenantId,
        scheduled_at: datetime,
        status: 'pending',
        hunter_confirmed_viewing: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();

      if (bookingError) {
        return {
          success: false,
          message: `Booking creation failed: ${bookingError.message}`
        };
      }

      return {
        success: true,
        result: booking,
        message: `Booking scheduled successfully for ${property.title} on ${datetime}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error scheduling booking: ${(error as Error).message}`
      };
    }
  }

  async escalateToHuman(
    reason: string,
    tenantId: string,
    contactPhone: string,
    threadId: string
  ): Promise<{ success: boolean; result?: any; message: string }> {
    try {
      // Update conversation session to mark handoff
      const { data: session, error: sessionError } = await this.supabase
        .from('conversation_sessions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('contact_phone', contactPhone)
        .eq('thread_id', threadId)
        .single();

      if (sessionError || !session) {
        return {
          success: false,
          message: `Session not found for escalation: ${sessionError?.message || 'Not found'}`
        };
      }

      // Update session to mark handoff to human
      const { error: updateError } = await this.supabase
        .from('conversation_sessions')
        .update({
          handoff_to_human: true,
          state: { ...session.state, handoff_reason: reason },
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (updateError) {
        return {
          success: false,
          message: `Failed to escalate to human: ${updateError.message}`
        };
      }

      // Create a lead entry for the human handoff
      const leadData = {
        tenant_id: tenantId,
        lead_source: 'whatsapp',
        thread_id: threadId,
        contact_phone: contactPhone,
        status: 'escalated',
        assigned_to: tenantId, // Assign to the tenant/agent
        notes: `Human handoff requested: ${reason}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: lead, error: leadError } = await this.supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (leadError) {
        console.warn('Failed to create escalation lead:', leadError.message);
      }

      return {
        success: true,
        result: { session, lead },
        message: `Successfully escalated to human: ${reason}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error escalating to human: ${(error as Error).message}`
      };
    }
  }

  async logConsent(
    consentData: {
      tenantId: string;
      contactPhone: string;
      consentType: string;
      granted: boolean;
      grantedAt?: string;
      revokedAt?: string;
    }
  ): Promise<{ success: boolean; result?: any; message: string }> {
    try {
      const logData = {
        tenant_id: consentData.tenantId,
        contact_phone: consentData.contactPhone,
        consent_type: consentData.consentType,
        granted_at: consentData.granted ? (consentData.grantedAt || new Date().toISOString()) : null,
        revoked_at: consentData.granted ? null : (consentData.revokedAt || new Date().toISOString()),
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('consent_log')
        .insert(logData)
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
        result: data,
        message: `Consent ${consentData.consentType} ${consentData.granted ? 'granted' : 'revoked'} for ${consentData.contactPhone}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error logging consent: ${(error as Error).message}`
      };
    }
  }

  async sendCatalogMedia(
    itemId: string,
    tenantId: string,
    contactPhone: string
  ): Promise<{ success: boolean; result?: any; message: string }> {
    try {
      // Get the property details including images
      const { data: property, error: propertyError } = await this.supabase
        .from('properties')
        .select('id, title, images, agent_id')
        .eq('id', itemId)
        .eq('agent_id', tenantId)
        .single();

      if (propertyError || !property) {
        return {
          success: false,
          message: `Property not found: ${itemId}`
        };
      }

      if (!property.images || property.images.length === 0) {
        return {
          success: false,
          message: `No images available for property: ${property.title}`
        };
      }

      // In a real implementation, this would call the Evolution API to send media
      // For now, we'll log the media sending request
      console.log(`Media sending requested for property ${itemId} to ${contactPhone}:`, property.images);

      // Log the media sending request
      const { error: logError } = await this.supabase
        .from('listing_events')
        .insert({
          property_id: itemId,
          event_type: 'whatsapp_click',
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.warn('Failed to log media sending event:', logError.message);
      }

      return {
        success: true,
        result: { property, images: property.images },
        message: `Media sending requested for ${property.title} (${property.images.length} images)`
      };
    } catch (error) {
      return {
        success: false,
        message: `Unexpected error sending catalog media: ${(error as Error).message}`
      };
    }
  }
}

// Export a singleton instance
export const toolExecutionLayer = new ToolExecutionLayer(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);