import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { formatPhoneNumber } from "../_shared/payments.ts";

async function verifyHmac(appSecret: string, rawBody: string, signature: string): Promise<boolean> {
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

interface WhatsAppMessage {
  from: string; // sender's phone number (wa-id)
  id: string;
  type: string;
  text?: { body: string };
}

function classifyIntent(body: string): string {
  const text = body.toLowerCase();
  if (/(buy|view|interested|rent|apartment|house)/.test(text)) return "viewing_lead";
  if (/(sell|list|price|advertise)/.test(text)) return "listing_lead";
  return "general_lead";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // WhatsApp Business Cloud API verification handshake.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN")) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Verification failed", { status: 403, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Hub-Signature-256") ?? "";
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    if (!appSecret || !(await verifyHmac(appSecret, rawBody, signature))) {
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    const payload = JSON.parse(rawBody);
    const messages = payload?.entry?.flatMap((e: any) =>
      e.changes?.flatMap((c: any) => c.value?.messages ?? [])
    ) ?? [];

    if (messages.length === 0) {
      // Status updates and echoes are intentionally ignored.
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    for (const message of messages as WhatsAppMessage[]) {
      const phone = formatPhoneNumber(message.from);
      const body = message.text?.body ?? "";

      // Fan an inbound thread out to the agent that owns the route for this
      // sender's national number.
      const { data: route } = await supabase
        .from("whatsapp_agent_routes")
        .select("agent_id")
        .eq("phone_number", phone)
        .maybeSingle();
      if (!route) continue;

      const contactName = payload?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name;

      const lead = {
        agent_id: route.agent_id,
        title: `${contactName ?? "WhatsApp lead"}: ${body.slice(0, 60)}`,
        lead_name: contactName ?? message.from,
        lead_phone: phone,
        lead_source: "whatsapp",
        whatsapp_thread_id: message.id,
        stage: "new_lead",
      };

      // (agent_id, whatsapp_thread_id) is unique — retried webhooks update in
      // place, never producing duplicate CRM rows.
      const { error } = await supabase.from("agent_workspace_items").insert(lead);
      if (error && error.code === "23505") {
        await supabase
          .from("agent_workspace_items")
          .update({ updated_at: new Date().toISOString(), stage: classifyIntent(body) })
          .eq("agent_id", route.agent_id)
          .eq("whatsapp_thread_id", message.id);
      } else if (error) {
        throw error;
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("whatsapp-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});