import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// AI-assisted listing writeup, shipped as a feature-flagged stub. The flag
// gate lives in the environment (ML_FEATURE_FLAGS is a comma-separated list),
// so the endpoint is safe to deploy today and lights up when a hosted model
// is attached. The current body is a deterministic template, not model output.

function flagEnabled(flags: string | undefined, name: string): boolean {
  return (flags ?? "").split(",").map((f) => f.trim()).includes(name);
}

function buildWriteup(property: {
  title: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  neighborhood: string;
  county: string;
  price: number;
}): { description: string } {
  const beds = property.bedrooms > 0 ? `${property.bedrooms} bedroom(s)` : "well-planned space";
  return {
    description:
      `A ${beds} ${property.type} in ${property.neighborhood}, ${property.county} ` +
      `with ${property.bathrooms} bathroom(s), available for KES ${property.price.toLocaleString("en-KE")}/month. ` +
      `Ideally located for commuters and families, with a neighbourhood signal rating kept current ` +
      `by verified Dimora residents. Contact the listing agent to arrange a viewing.`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!flagEnabled(Deno.env.get("ML_FEATURE_FLAGS"), "listing_writeup")) {
      return new Response(
        JSON.stringify({ disabled: true, error: "listing_writeup feature flag is off" }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { propertyId } = await req.json();
    if (!propertyId) {
      return new Response(JSON.stringify({ error: "propertyId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: property, error } = await supabase
      .from("properties")
      .select("title, type, bedrooms, bathrooms, neighborhood, county, price")
      .eq("id", propertyId)
      .maybeSingle();

    if (error) throw error;
    if (!property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(buildWriteup(property)), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});