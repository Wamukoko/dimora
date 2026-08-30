import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Outbound SMS. Phase 5 ships this as a stubbed gateway: with the vendor
// unset (or anything other than 'africastalking') the function acknowledges
// the request without sending, so the rest of the app can be wired end to end
// without a paid SMS account. When configured it calls Africa's Talking's
// HTTP API directly (no SDK dependency).
const AT_ENDPOINT = "https://api.africastalking.com/version1/messaging";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone, message } = await req.json();
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vendor = Deno.env.get("SMS_GATEWAY_VENDOR") ?? "";
    const apiKey = Deno.env.get("SMS_GATEWAY_API_KEY");
    const username = Deno.env.get("SMS_GATEWAY_USERNAME");

    if (vendor !== "africastalking" || !apiKey || !username) {
      return new Response(
        JSON.stringify({ sent: false, stubbed: true, note: "SMS gateway not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const form = new URLSearchParams({
      username,
      to: phone,
      message,
      from: Deno.env.get("SMS_GATEWAY_FROM") ?? "DIMORA",
    });

    const response = await fetch(AT_ENDPOINT, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `AT responded ${response.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    return new Response(JSON.stringify({ sent: true, result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});