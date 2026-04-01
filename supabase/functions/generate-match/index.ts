import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Fetch active operators
    const { data: operadores } = await supabase
      .from("operadores")
      .select("*")
      .eq("activo", true);

    if (!operadores || operadores.length === 0) {
      return new Response(JSON.stringify({ matches: [], message: "No hay operadores activos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- STEP 1: Rule-based scoring ---
    const scored = operadores.map((op: any) => {
      let score = 0;
      const tags: string[] = [];
      const reasons: string[] = [];

      // Surface compatibility (40 points)
      const supLocal = Number(local.superficie_m2);
      const supMin = Number(op.superficie_min);
      const supMax = Number(op.superficie_max);
      
      if (supMax > 0 && supLocal >= supMin && supLocal <= supMax) {
        score += 40;
        tags.push("superficie_compatible");
        reasons.push(`Superficie ${supLocal}m² dentro del rango ${supMin}-${supMax}m²`);
      } else if (supMax > 0) {
        const minDist = Math.min(Math.abs(supLocal - supMin), Math.abs(supLocal - supMax));
        const maxRange = Math.max(supMax, supLocal);
        const partial = Math.max(0, 40 - (minDist / (maxRange || 1)) * 40);
        score += Math.round(partial);
        if (partial > 20) {
          tags.push("superficie_parcial");
          reasons.push(`Superficie ${supLocal}m² parcialmente compatible (rango: ${supMin}-${supMax}m²)`);
        } else {
          reasons.push(`Superficie ${supLocal}m² fuera del rango ${supMin}-${supMax}m²`);
        }
      } else {
        score += 20; // No range defined, neutral
        reasons.push("Sin rango de superficie definido por operador");
      }

      // Budget compatibility (40 points)
      const rentaLocal = Number(local.precio_renta);
      const presMin = Number(op.presupuesto_min);
      const presMax = Number(op.presupuesto_max);

      if (presMax > 0 && rentaLocal >= presMin && rentaLocal <= presMax) {
        score += 40;
        tags.push("presupuesto_compatible");
        reasons.push(`Renta ${rentaLocal}€ dentro del presupuesto ${presMin}-${presMax}€`);
      } else if (presMax > 0) {
        const minDist = Math.min(Math.abs(rentaLocal - presMin), Math.abs(rentaLocal - presMax));
        const maxRange = Math.max(presMax, rentaLocal);
        const partial = Math.max(0, 40 - (minDist / (maxRange || 1)) * 40);
        score += Math.round(partial);
        if (partial > 20) {
          tags.push("presupuesto_parcial");
          reasons.push(`Renta ${rentaLocal}€ parcialmente compatible (presupuesto: ${presMin}-${presMax}€)`);
        } else {
          reasons.push(`Renta ${rentaLocal}€ fuera del presupuesto ${presMin}-${presMax}€`);
        }
      } else {
        score += 20;
        reasons.push("Sin presupuesto definido por operador");
      }

      // Sector bonus (20 points)
      const sector = (op.sector || "").toLowerCase();
      score += 10;
      tags.push("sector_" + sector.replace(/\s/g, "_"));
      reasons.push(`Sector: ${op.sector || "general"}`);

      // AI profile bonus
      if (op.perfil_ia) {
        score += 5;
        tags.push("perfil_ia");
      }

      return {
        operador_id: op.id,
        operador_nombre: op.nombre,
        operador_sector: op.sector,
        score: Math.min(score, 100),
        tags,
        reasons,
        superficie_range: `${supMin}-${supMax}`,
        presupuesto_range: `${presMin}-${presMax}`,
      };
    });

    // Top matches (score > 20, max 10)
    const topMatches = scored
      .sort((a: any, b: any) => b.score - a.score)
      .filter((m: any) => m.score > 20)
      .slice(0, 10);

    // --- STEP 2: AI-powered explanations (if API key available) ---
    let aiExplanations: Record<string, string> = {};
    let modelo = "rule-based-v2";
    let tokensIn = 0;
    let tokensOut = 0;
    let aiCost = 0;

    if (lovableApiKey && topMatches.length > 0) {
      try {
        const prompt = `Eres un experto en retail inmobiliario comercial. Analiza estos matches entre un local comercial y operadores.

LOCAL:
- Nombre: ${local.nombre}
- Dirección: ${local.direccion}, ${local.ciudad}
- Superficie: ${local.superficie_m2} m²
- Renta: ${local.precio_renta} €/mes
- Estado: ${local.estado}
- Descripción: ${local.descripcion || "No disponible"}

MATCHES TOP (ordenados por score):
${topMatches.map((m: any, i: number) => `${i + 1}. ${m.operador_nombre} (${m.operador_sector}) - Score: ${m.score}%
   Superficie requerida: ${m.superficie_range}m² | Presupuesto: ${m.presupuesto_range}€
   Razones: ${m.reasons.join("; ")}`).join("\n")}

Para cada match, genera una explicación breve (máximo 2 frases) en español que explique por qué es buena o mala combinación, considerando compatibilidad de superficie, presupuesto y tipo de negocio. Sé específico y útil para un gestor inmobiliario.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-preview",
            messages: [
              { role: "system", content: "Eres un asistente de retail inmobiliario. Responde SOLO con un JSON array donde cada elemento tiene 'operador_nombre' y 'explicacion'. Sin markdown, sin texto extra." },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "provide_match_explanations",
                  description: "Provide AI explanations for each match",
                  parameters: {
                    type: "object",
                    properties: {
                      explanations: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            operador_nombre: { type: "string" },
                            explicacion: { type: "string", description: "Brief 1-2 sentence explanation in Spanish" },
                          },
                          required: ["operador_nombre", "explicacion"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["explanations"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "provide_match_explanations" } },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          modelo = "gemini-3.1-flash";
          tokensIn = aiData.usage?.prompt_tokens || 0;
          tokensOut = aiData.usage?.completion_tokens || 0;
          aiCost = (tokensIn * 0.00001 + tokensOut * 0.00004); // approximate

          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed.explanations) {
              for (const exp of parsed.explanations) {
                aiExplanations[exp.operador_nombre] = exp.explicacion;
              }
            }
          }
        } else {
          console.error("AI gateway error:", aiResponse.status, await aiResponse.text());
        }
      } catch (aiError) {
        console.error("AI explanation error:", aiError);
        // Continue with rule-based explanations
      }
    }

    // --- STEP 3: Insert matches ---
    const matchInserts = topMatches.map((m: any) => {
      const aiExpl = aiExplanations[m.operador_nombre];
      const fallbackExpl = `Score ${m.score}%: ${m.reasons.join(". ")}.`;

      return {
        local_id,
        operador_id: m.operador_id,
        score: m.score,
        explicacion: aiExpl || fallbackExpl,
        tags: m.tags,
        estado: m.score >= 70 ? "sugerido" : "pendiente",
        generado_por: user.id,
      };
    });

    const { data: insertedMatches, error: insertError } = await supabase
      .from("matches")
      .insert(matchInserts)
      .select();

    const latency = Date.now() - startTime;

    // Audit log
    await supabase.from("auditoria_ia").insert({
      local_id,
      modelo,
      funcion_ia: "matching",
      tokens_entrada: tokensIn,
      tokens_salida: tokensOut,
      coste_estimado: aiCost,
      latencia_ms: latency,
      exito: !insertError,
      error_mensaje: insertError?.message || null,
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({
        matches: insertedMatches || [],
        latency_ms: latency,
        modelo,
        ai_enhanced: !!lovableApiKey && Object.keys(aiExplanations).length > 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("generate-match error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
