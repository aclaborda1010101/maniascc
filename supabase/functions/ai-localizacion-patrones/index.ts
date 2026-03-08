import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { coordenadas_lat, coordenadas_lon, radio_km = 5, tipo_centro = "centro_comercial", presupuesto_estimado } = await req.json();
    if (!coordenadas_lat || !coordenadas_lon) throw new Error("Coordenadas requeridas");

    const startTime = Date.now();

    // Get existing locales near the coordinates for context
    const { data: localesCercanos } = await supabase
      .from("locales")
      .select("nombre, ciudad, superficie_m2, precio_renta, estado")
      .limit(10);

    const { data: operadoresActivos } = await supabase
      .from("operadores")
      .select("nombre, sector, presupuesto_min, presupuesto_max")
      .eq("activo", true)
      .limit(15);

    const prompt = `Eres un experto analista inmobiliario retail español. Analiza la viabilidad de una localización para un ${tipo_centro.replace(/_/g, " ")} en las coordenadas (${coordenadas_lat}, ${coordenadas_lon}) con radio de ${radio_km}km.${presupuesto_estimado ? ` Presupuesto estimado: ${presupuesto_estimado}€.` : ""}

Contexto de locales existentes en cartera: ${JSON.stringify(localesCercanos || [])}.
Operadores activos buscando local: ${JSON.stringify(operadoresActivos || [])}.

Genera un análisis completo con score de viabilidad 0-100 evaluando estas 5 dimensiones:
1. Demografía y poder adquisitivo (peso 25%)
2. Accesibilidad y movilidad (peso 20%)
3. Competencia y saturación (peso 25%)
4. Potencial de demanda (peso 20%)
5. Entorno urbanístico y regulatorio (peso 10%)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Eres ATLAS NEXUS, el agente de inteligencia de localización. Responde SOLO con el tool call solicitado." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "location_analysis",
            description: "Análisis de viabilidad de localización",
            parameters: {
              type: "object",
              properties: {
                score_viabilidad: { type: "number", description: "Score 0-100" },
                confianza: { type: "number", description: "Nivel de confianza 0-100" },
                desglose_variables: {
                  type: "object",
                  properties: {
                    demografia: { type: "object", properties: { score: { type: "number" }, detalle: { type: "string" } }, required: ["score", "detalle"] },
                    accesibilidad: { type: "object", properties: { score: { type: "number" }, detalle: { type: "string" } }, required: ["score", "detalle"] },
                    competencia: { type: "object", properties: { score: { type: "number" }, detalle: { type: "string" } }, required: ["score", "detalle"] },
                    demanda: { type: "object", properties: { score: { type: "number" }, detalle: { type: "string" } }, required: ["score", "detalle"] },
                    urbanismo: { type: "object", properties: { score: { type: "number" }, detalle: { type: "string" } }, required: ["score", "detalle"] },
                  },
                  required: ["demografia", "accesibilidad", "competencia", "demanda", "urbanismo"],
                },
                riesgos: { type: "array", items: { type: "object", properties: { nivel: { type: "string" }, descripcion: { type: "string" } }, required: ["nivel", "descripcion"] } },
                oportunidades: { type: "array", items: { type: "object", properties: { impacto: { type: "string" }, descripcion: { type: "string" } }, required: ["impacto", "descripcion"] } },
                recomendacion: { type: "string" },
              },
              required: ["score_viabilidad", "confianza", "desglose_variables", "riesgos", "oportunidades", "recomendacion"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "location_analysis" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Límite de peticiones excedido, intenta más tarde." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos agotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Error del gateway IA");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis;
    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    } else {
      throw new Error("No se pudo obtener análisis estructurado");
    }

    const latencyMs = Date.now() - startTime;

    // Save to DB
    const { data: saved, error: saveError } = await supabase.from("patrones_localizacion").insert({
      coordenadas_lat, coordenadas_lon, radio_km, tipo_centro,
      score_viabilidad: analysis.score_viabilidad,
      desglose_variables: analysis.desglose_variables,
      riesgos: analysis.riesgos,
      oportunidades: analysis.oportunidades,
      confianza: analysis.confianza,
      fuentes_consultadas: [{ tipo: "datos_internos", detalle: "Locales y operadores en cartera ATLAS" }],
      usuario_id: user.id,
    }).select().single();

    // Audit
    await supabase.from("auditoria_ia").insert({
      modelo: "google/gemini-3-flash-preview",
      funcion_ia: "localizacion-patrones",
      latencia_ms: latencyMs,
      exito: true,
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      coste_estimado: 0.15,
      created_by: user.id,
    });

    return new Response(JSON.stringify({ ...analysis, id: saved?.id, latencia_ms: latencyMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("localizacion-patrones error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
