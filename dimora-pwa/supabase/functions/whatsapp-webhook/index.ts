import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import { evolutionApiService } from "./evolutionApiService.ts";

// Webhook signature verification
async function verifyWebhookSignature(
  appSecret: string,
  rawBody: string,
  signature: string
): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" + Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  
  const provided = signature.slice(7);
  if (expected.length !== provided.length) return false;
  
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  
  return diff === 0;
}

interface EvolutionWebhookMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: number;
  type: 'text' | 'media' | 'interactive';
  instance: string;
}

interface EvolutionWebhookPayload {
  event: string;
  data: {
    instance: string;
    message: EvolutionWebhookMessage;
    timestamp: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Hub-Signature-256") ?? "";
    const instanceName = req.method === "POST" ? req.url.split("/").pop() : null;

    if (!instanceName) {
      return new Response("Instance name not found in URL", { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get the Evolution API instance to retrieve the webhook secret
    const { data: instance, error: instanceError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    .from("whatsapp_instances")
    .select("webhook_secret, evolution_instance_name")
    .eq("evolution_instance_name", instanceName)
    .eq("status", "active")
    .single();

    if (instanceError || !instance) {
      console.error("Instance not found:", instanceError);
      return new Response("Instance not found or inactive", { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify webhook signature
    const appSecret = instance.webhook_secret;
    if (!appSecret || !(await verifyWebhookSignature(appSecret, rawBody, signature))) {
      return new Response("Invalid signature", { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parse webhook payload
    let payload: EvolutionWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      return new Response("Invalid JSON payload", { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check idempotency - ensure webhook hasn't been processed before
    const idempotencyCheck = await evolutionApiService.checkWebhookIdempotency(payload.data.message.id);
    if (!idempotencyCheck.canProcess) {
      console.log("Webhook already processed (idempotent):", payload.data.message.id);
      return new Response("ok", { headers: corsHeaders }); // Return 200 to acknowledge, but don't process
    }

    // Resolve instance to tenant
    const resolveResult = await evolutionApiService.resolveInstanceToTenant(instanceName);
    if (!resolveResult.success) {
      console.error("Failed to resolve instance to tenant:", resolveResult.message);
      return new Response("Failed to resolve instance", { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const tenantId = resolveResult.tenantId;

    // Log the webhook message to messages_log for idempotency and audit trail
    const logResult = await evolutionApiService.logWebhookMessage({
      tenantId,
      threadId: payload.data.message.id,
      evolutionMessageId: payload.data.message.id,
      direction: 'inbound',
      payload: payload
    });

    if (!logResult.success) {
      console.error("Failed to log webhook message:", logResult.message);
      return new Response("Failed to log webhook", { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Process the message based on its type
    const message = payload.data.message;
    const phone = message.from;
    const body = message.message;

    // Store in agent_workspace_items for CRM/lead tracking
    const { data: agentRoute, error: routeError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    .from("agent_workspace_items")
    .select("agent_id")
    .eq("lead_phone", phone)
    .eq("lead_source", "whatsapp")
    .maybeSingle();

    if (!agentRoute) {
      console.log("No agent route found for phone:", phone);
      return new Response("ok", { headers: corsHeaders }); // Acknowledge but don't process
    }

    // Create or update lead in agent_workspace_items
    const leadData = {
      agent_id: agentRoute.agent_id,
      title: `WhatsApp lead: ${body.slice(0, 60)}...`,
      lead_name: phone,
      lead_phone: phone,
      lead_source: "whatsapp",
      whatsapp_thread_id: message.id,
      stage: classifyIntent(body),
      notes: JSON.stringify(payload.data)
    };

    const { error: insertError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    .from("agent_workspace_items")
    .upsert(leadData, {
      onConflict: 'whatsapp_thread_id',
      merge: true
    });

    if (insertError) {
      console.error("Failed to upsert lead:", insertError);
      return new Response("Failed to process lead", { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Successfully processed WhatsApp webhook:", {
      instance: instanceName,
      messageId: message.id,
      phone: phone,
      tenantId,
      agentId: agentRoute.agent_id
    });

    return new Response("ok", { headers: corsHeaders });

  } catch (error: any) {
    console.error("WhatsApp webhook processing error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

function classifyIntent(body: string): string {
  const text = body.toLowerCase();
  if (/(buy|view|interested|rent|apartment|house)/.test(text)) return "viewing_lead";
  if (/(sell|list|price|advertise)/.test(text)) return "listing_lead";
  return "general_lead";
}