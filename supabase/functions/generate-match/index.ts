import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { local_id } = await req.json();
    if (!local_id) {
      return new Response(JSON.stringify({ error: "local_id requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();

    // Fetch local
    const { data: local, error: localError } = await supabase
      .from("locales")
      .select("*")
      .eq("id", local_id)
      .single();

    if (localError || !local) {
      return new Response(JSON.stringify({ error: "Local no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active operadores
    const { data: operadores } = await supabase
      .from("operadores")
      .select("*")
      .eq("activo", true);

    if (!operadores || operadores.length === 0) {
      return new Response(JSON.stringify({ matches: [], message: "No hay operadores activos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rule-based matching
    const scored = operadores.map((op: any) => {
      let score = 0;
      const tags: string[] = [];

      // Surface compatibility (40 points)
      const supLocal = Number(local.superficie_m2);
      if (supLocal >= Number(op.superficie_min) && supLocal <= Number(op.superficie_max)) {
        score += 40;
        tags.push("superficie_compatible");
      } else {
        const minDist = Math.min(
          Math.abs(supLocal - Number(op.superficie_min)),
          Math.abs(supLocal - Number(op.superficie_max))
        );
        const maxRange = Math.max(Number(op.superficie_max), supLocal);
        const partial = Math.max(0, 40 - (minDist / (maxRange || 1)) * 40);
        score += Math.round(partial);
        if (partial > 20) tags.push("superficie_parcial");
      }

      // Budget compatibility (40 points)
      const rentaLocal = Number(local.precio_renta);
      if (rentaLocal >= Number(op.presupuesto_min) && rentaLocal <= Number(op.presupuesto_max)) {
        score += 40;
        tags.push("presupuesto_compatible");
      } else {
        const minDist = Math.min(
          Math.abs(rentaLocal - Number(op.presupuesto_min)),
          Math.abs(rentaLocal - Number(op.presupuesto_max))
        );
        const maxRange = Math.max(Number(op.presupuesto_max), rentaLocal);
        const partial = Math.max(0, 40 - (minDist / (maxRange || 1)) * 40);
        score += Math.round(partial);
        if (partial > 20) tags.push("presupuesto_parcial");
      }

      // Sector bonus (20 points) — always give some since we don't have local sector yet
      score += 10;
      tags.push("sector_" + (op.sector || "general").toLowerCase().replace(/\s/g, "_"));

      return {
        operador_id: op.id,
        score: Math.min(score, 100),
        tags,
        explicacion: `Score ${Math.min(score, 100)}%: ${tags.join(", ")}. Superficie local: ${supLocal}m² (rango op: ${op.superficie_min}-${op.superficie_max}m²). Renta: ${rentaLocal}€ (presupuesto op: ${op.presupuesto_min}-${op.presupuesto_max}€).`,
      };
    });

    // Top 5 by score
    const top5 = scored.sort((a: any, b: any) => b.score - a.score).slice(0, 5);

    // Insert matches
    const matchInserts = top5.map((m: any) => ({
      local_id,
      operador_id: m.operador_id,
      score: m.score,
      explicacion: m.explicacion,
      tags: m.tags,
      estado: "pendiente",
      generado_por: user.id,
    }));

    const { data: insertedMatches, error: insertError } = await supabase
      .from("matches")
      .insert(matchInserts)
      .select();

    const latency = Date.now() - startTime;

    // Audit log
    await supabase.from("auditoria_ia").insert({
      local_id,
      modelo: "rule-based-v1",
      tokens_entrada: 0,
      tokens_salida: 0,
      coste_estimado: 0,
      latencia_ms: latency,
      exito: !insertError,
      error_mensaje: insertError?.message || null,
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({ matches: insertedMatches || [], latency_ms: latency }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
