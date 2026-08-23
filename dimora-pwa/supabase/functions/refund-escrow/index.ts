import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Mirrors release-escrow: hunter-authenticated, idempotent via escrow_status='held'.
// Ledger transition only — actual money movement (Daraja B2C reversal / manual M-PESA
// reversal) is gated behind ADR-005 and handled by the settlement SOP.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bookingId } = await req.json();
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, hunter_id")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking || booking.hunter_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Not authorized to refund this deposit" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: refunded, error: refundError } = await supabase
      .from("payments")
      .update({ escrow_status: "refunded_to_hunter", updated_at: new Date().toISOString() })
      .eq("booking_id", bookingId)
      .eq("purpose", "viewing_deposit")
      .eq("escrow_status", "held")
      .select("id");

    if (refundError) throw refundError;

    return new Response(JSON.stringify({ success: true, refunded: refunded?.length ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
