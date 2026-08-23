import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Validate the shared-secret token before doing anything else.
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token !== Deno.env.get("MPESA_CALLBACK_SECRET")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) return new Response("Invalid Payload", { status: 400 });

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (ResultCode === 0) {
      const items: Array<{ Name: string; Value: any }> = CallbackMetadata.Item;
      const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

      // Idempotent update — ".eq(status, 'pending')" makes a retried webhook a no-op.
      const { data: payment } = await supabase
        .from("payments")
        .update({
          status: "completed",
          mpesa_receipt_number: receipt,
          raw_callback: body,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", CheckoutRequestID)
        .eq("status", "pending")
        .select("booking_id, purpose")
        .single();

      if (payment?.booking_id) {
        // Escrow stays 'held' — release only happens when the hunter confirms the
        // viewing occurred (release-escrow), never automatically on payment success.
        await supabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("id", payment.booking_id)
          .eq("status", "pending");
      }
    } else {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          failure_reason: ResultDesc,
          raw_callback: body,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", CheckoutRequestID)
        .eq("status", "pending"); // idempotent here too
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
  } catch (_err: any) {
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }), { status: 500 });
  }
});
