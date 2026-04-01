import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function queryJarvisPatterns(queryType: string, filters: Record<string, unknown>): Promise<any> {
  try {
    const url = Deno.env.get("JARVIS_PATTERNS_URL");
    const key = Deno.env.get("JARVIS_PATTERNS_API_KEY");
    if (!url || !key) return null;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "public_query_v2", api_key: key, query_type: queryType, filters }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

async function sendJarvisFeedback(feedbackType: string, data: Record<string, unknown>): Promise<void> {
  try {
    const url = Deno.env.get("JARVIS_PATTERNS_URL");
    const key = Deno.env.get("JARVIS_PATTERNS_API_KEY");
    if (!url || !key) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "feedback_ingest", api_key: key, feedback_type: feedbackType, data }),
    });
  } catch { /* fail-safe */ }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { centro_nombre, centro_ubicacion, locales_disponibles } = await req.json();
    if (!centro_nombre) throw new Error("Nombre del centro requerido");

    const startTime = Date.now();

    const { data: operadores } = await supabase.from("operadores").select("*").eq("activo", true).limit(30);
    const { data: sinergias } = await supabase.from("sinergias_operadores").select("*").limit(100);

    // JARVIS: success_patterns + benchmarks (fail-safe, parallel)
    const [jarvisSuccess, jarvisBenchmarks] = await Promise.all([
      queryJarvisPatterns("success_patterns", { sector: "centros_comerciales", geography: centro_ubicacion || "" }),
      queryJarvisPatterns("benchmarks", { sector: "centros_comerciales" }),
    ]);

    let jarvisContext = "";
    if (jarvisSuccess && !jarvisSuccess.error) {
      const signals = jarvisSuccess.success_signals || jarvisSuccess.signals || [];
      if (signals.length > 0) {
        jarvisContext += `\n\n📡 PATRONES DE ÉXITO JARVIS:\n${JSON.stringify(signals.slice(0, 10), null, 2)}`;
        if (jarvisSuccess.success_blueprint) jarvisContext += `\nBlueprint de éxito: ${JSON.stringify(jarvisSuccess.success_blueprint)}`;
      }
    }
    if (jarvisBenchmarks && !jarvisBenchmarks.error && jarvisBenchmarks.reference_benchmarks) {
      jarvisContext += `\n\n📊 BENCHMARKS DE REFERENCIA JARVIS:\n${JSON.stringify(jarvisBenchmarks.reference_benchmarks)}`;
    }

    const prompt = `Eres un experto en comercialización de centros comerciales en España. Genera 3 planes de tenant mix optimizado para "${centro_nombre}"${centro_ubicacion ? ` en ${centro_ubicacion}` : ""}.

Locales disponibles: ${JSON.stringify(locales_disponibles || "No especificados")}
Operadores activos en cartera: ${JSON.stringify((operadores || []).map(o => ({ nombre: o.nombre, sector: o.sector, presupuesto: \`\${o.presupuesto_min}-\${o.presupuesto_max}€\`, superficie: \`\${o.superficie_min}-\${o.superficie_max}m²\` })))}
Sinergias conocidas: ${JSON.stringify((sinergias || []).slice(0, 20))}${jarvisContext}

Plan A: Máximo valor (operadores premium, renta alta)
Plan B: Equilibrado (alta probabilidad de cierre)
Plan C: Seguridad (ocupación rápida, renta competitiva)

Para cada plan incluye operadores recomendados, score de sinergia, predicción de ocupación y riesgos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "Eres AVA TURING NEXUS avanzado, optimizador de tenant mix. Responde SOLO con el tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "tenant_mix_optimization",
            description: "Genera 3 planes de tenant mix A/B/C",
            parameters: {
              type: "object",
              properties: {
                planes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      plan: { type: "string", enum: ["A", "B", "C"] },
                      perfil: { type: "string" },
                      operadores_recomendados: { type: "array", items: { type: "object", properties: { nombre: { type: "string" }, sector: { type: "string" }, rol: { type: "string" }, renta_estimada: { type: "number" } }, required: ["nombre", "sector", "rol"] } },
                      score_sinergia_total: { type: "number" },
                      prediccion_ocupacion: { type: "number" },
                      renta_estimada_total: { type: "number" },
                      riesgos: { type: "array", items: { type: "string" } },
                    },
                    required: ["plan", "perfil", "operadores_recomendados", "score_sinergia_total", "prediccion_ocupacion"],
                  },
                },
                sinergias_detectadas: { type: "array", items: { type: "object", properties: { operador_a: { type: "string" }, operador_b: { type: "string" }, tipo: { type: "string" }, coeficiente: { type: "number" } }, required: ["operador_a", "operador_b", "tipo", "coeficiente"] } },
                recomendacion_general: { type: "string" },
              },
              required: ["planes", "sinergias_detectadas", "recomendacion_general"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "tenant_mix_optimization" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Límite de peticiones excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos agotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Error del gateway IA");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result;
    if (toolCall?.function?.arguments) {
      result = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    } else {
      throw new Error("No se pudo obtener optimización");
    }

    const latencyMs = Date.now() - startTime;

    for (const plan of result.planes || []) {
      await supabase.from("configuraciones_tenant_mix").insert({
        centro_nombre, centro_ubicacion,
        plan: plan.plan,
        operadores_recomendados: plan.operadores_recomendados,
        score_sinergia_total: plan.score_sinergia_total,
        prediccion_ocupacion: plan.prediccion_ocupacion,
        renta_estimada_total: plan.renta_estimada_total || 0,
        riesgos: plan.riesgos || [],
        usuario_id: user.id,
      });
    }

    await supabase.from("auditoria_ia").insert({
      modelo: "google/gemini-2.5-pro",
      funcion_ia: "tenant-mix-avanzado",
      latencia_ms: latencyMs,
      exito: true,
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      coste_estimado: 0.25,
      created_by: user.id,
    });

    // JARVIS feedback (fail-safe)
    sendJarvisFeedback("tenant_mix_result", {
      geography: centro_ubicacion || centro_nombre,
      sector: "centros_comerciales",
      outcome: "generated",
      metrics: { planes_count: (result.planes || []).length, sinergias: (result.sinergias_detectadas || []).length },
    });

    return new Response(JSON.stringify({ ...result, latencia_ms: latencyMs, jarvis_enriched: !!(jarvisSuccess || jarvisBenchmarks) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tenant-mix error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
