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

    const { metricas_declaradas, tipo_activo = "centro_comercial", ubicacion, codigo_postal, propietario_ref } = await req.json();
    if (!metricas_declaradas) throw new Error("Métricas declaradas requeridas");

    const startTime = Date.now();

    const prompt = `Eres un analista senior de inversión inmobiliaria retail en España con 25 años de experiencia. Un propietario presenta un dossier con las siguientes métricas para un ${tipo_activo.replace(/_/g, " ")}${ubicacion ? ` en ${ubicacion}` : ""}${codigo_postal ? ` (CP: ${codigo_postal})` : ""}:

Métricas declaradas: ${JSON.stringify(metricas_declaradas)}

Analiza cada métrica y determina si parece realista o inflada, comparando con benchmarks del mercado español. Para cada métrica asigna un semáforo:
- verde: dentro de rangos normales del mercado
- amarillo: ligeramente por encima, requiere verificación
- rojo: significativamente inflada o sospechosa

Considera desviaciones típicas del sector: rentabilidad (15-30% inflación media), ocupación (10-20%), precio/m2 (5-15%), tráfico (20-40%).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: "Eres AVA TURING RADAR, el agente de validación de retornos. Responde SOLO con el tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "dossier_validation",
            description: "Validación de métricas de dossier",
            parameters: {
              type: "object",
              properties: {
                semaforos: {
                  type: "object",
                  description: "Objeto con cada métrica y su semáforo (verde/amarillo/rojo)",
                  additionalProperties: {
                    type: "object",
                    properties: {
                      color: { type: "string", enum: ["verde", "amarillo", "rojo"] },
                      valor_declarado: { type: "string" },
                      benchmark_mercado: { type: "string" },
                      desviacion_pct: { type: "number" },
                      explicacion: { type: "string" },
                    },
                    required: ["color", "explicacion"],
                  },
                },
                confianza_global: { type: "number", description: "Confianza global 0-100 en el dossier" },
                desviaciones: { type: "array", items: { type: "object", properties: { metrica: { type: "string" }, severidad: { type: "string" }, detalle: { type: "string" } }, required: ["metrica", "severidad", "detalle"] } },
                benchmarks_usados: { type: "array", items: { type: "object", properties: { fuente: { type: "string" }, dato: { type: "string" } }, required: ["fuente", "dato"] } },
                veredicto: { type: "string" },
                recomendaciones: { type: "array", items: { type: "string" } },
              },
              required: ["semaforos", "confianza_global", "desviaciones", "benchmarks_usados", "veredicto", "recomendaciones"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "dossier_validation" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Límite de peticiones excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos agotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Error del gateway IA");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let validation;
    if (toolCall?.function?.arguments) {
      validation = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    } else {
      throw new Error("No se pudo obtener validación estructurada");
    }

    const latencyMs = Date.now() - startTime;

    const { data: saved } = await supabase.from("validaciones_retorno").insert({
      tipo_activo, ubicacion, codigo_postal, propietario_ref,
      metricas_declaradas,
      semaforos: validation.semaforos,
      desviaciones: validation.desviaciones,
      benchmarks_usados: validation.benchmarks_usados,
      confianza_global: validation.confianza_global,
      usuario_id: user.id,
    }).select().single();

    await supabase.from("auditoria_ia").insert({
      modelo: "google/gemini-2.0-flash-001",
      funcion_ia: "validacion-retorno",
      latencia_ms: latencyMs,
      exito: true,
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      coste_estimado: 0.10,
      created_by: user.id,
    });

    return new Response(JSON.stringify({ ...validation, id: saved?.id, latencia_ms: latencyMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validacion-retorno error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
