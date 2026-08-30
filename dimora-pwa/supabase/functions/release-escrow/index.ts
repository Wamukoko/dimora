import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { canReleaseEscrow } from "../_shared/payments.ts";

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
      .select("id, hunter_id, status")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking || booking.hunter_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Not authorized to confirm this viewing" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // State-machine guard: only a 'held' escrow may be released. A double
    // release (already 'released_to_agent' or 'refunded_to_hunter') is a 409,
    // and a disputed escrow must never be released automatically.
    const { data: payment } = await supabase
      .from("payments")
      .select("escrow_status")
      .eq("booking_id", bookingId)
      .eq("purpose", "viewing_deposit")
      .maybeSingle();

    if (payment && !canReleaseEscrow(payment.escrow_status)) {
      return new Response(
        JSON.stringify({ error: "Deposit is no longer in a releasable state" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("bookings").update({ hunter_confirmed_viewing: true }).eq("id", bookingId);

    // Idempotent — won't double-release.
    const { data: released, error: escrowError } = await supabase
      .from("payments")
      .update({ escrow_status: "released_to_agent", updated_at: new Date().toISOString() })
      .eq("booking_id", bookingId)
      .eq("purpose", "viewing_deposit")
      .eq("escrow_status", "held")
      .select("id");

    if (escrowError) throw escrowError;

    return new Response(JSON.stringify({ success: true, released: released?.length ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
