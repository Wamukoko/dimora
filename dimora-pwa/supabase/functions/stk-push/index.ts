import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "254" + cleaned.substring(1);
  else if (cleaned.startsWith("7") || cleaned.startsWith("1")) cleaned = "254" + cleaned;
  return cleaned;
}

async function getMpesaAccessToken(): Promise<string> {
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
  const environment = Deno.env.get("MPESA_ENVIRONMENT") || "sandbox";

  const url = environment === "production"
    ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
  });

  const data = await response.json();
  return data.access_token;
}

// Server-side amount authority — never trust a client-supplied amount.
// ADR-005 note: amounts are flat policy values until a pricing table exists.
async function resolveAuthoritativeAmount(
  purpose: "viewing_deposit" | "listing_boost" | "subscription" | "rent"
): Promise<number> {
  if (purpose === "viewing_deposit") {
    return 200; // KES, flat viewing deposit held in escrow
  }
  if (purpose === "listing_boost") {
    return 500; // KES, flat boost fee
  }
  throw new Error(`Unsupported or not-yet-priced payment purpose: ${purpose}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller via their JWT before doing anything else.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phoneNumber, bookingId, purpose = "viewing_deposit", accountReference = "DIMORA" } = await req.json();

    // 'amount' is intentionally NOT read from the request body.
    const amount = await resolveAuthoritativeAmount(purpose);

    const formattedPhone = formatPhoneNumber(phoneNumber);
    const shortCode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const environment = Deno.env.get("MPESA_ENVIRONMENT") || "sandbox";
    const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET")!;

    const now = new Date();
    now.setHours(now.getHours() + 3); // UTC+3 East Africa Time
    const timestamp = now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = btoa(`${shortCode}${passkey}${timestamp}`);

    const token = await getMpesaAccessToken();
    const stkPushUrl = environment === "production"
      ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
      : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${supabaseUrl}/functions/v1/mpesa-callback?token=${callbackSecret}`,
      AccountReference: accountReference.substring(0, 12),
      TransactionDesc: `Dimora-${accountReference}`.substring(0, 12),
    };

    const stkResponse = await fetch(stkPushUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const resData = await stkResponse.json();

    if (resData.ResponseCode === "0") {
      await supabase.from("payments").insert({
        merchant_request_id: resData.MerchantRequestID,
        checkout_request_id: resData.CheckoutRequestID,
        booking_id: bookingId || null,
        purpose,
        escrow_status: purpose === "viewing_deposit" ? "held" : null,
        phone_number: formattedPhone,
        amount,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ success: true, checkoutRequestId: resData.CheckoutRequestID }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: resData.CustomerMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
