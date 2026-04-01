import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * V4 Matching Engine with Predictive Learning
 * - Uses learned patterns from historical feedback
 * - Adjusts scores based on sector/zone/budget patterns
 * - Predicts probability of success
 */
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

    // Fetch learned patterns for adjustments
    const { data: patterns } = await supabase
      .from("ai_learned_patterns")
      .select("*")
      .eq("activo", true)
      .gte("num_observaciones", 3) // Only patterns with enough data
      .gte("confianza", 0.6);

    const patternMap = new Map<string, any>();
    for (const p of patterns || []) {
      patternMap.set(`${p.patron_tipo}:${p.patron_key}`, p);
    }

    // Fetch successful historical matches for comparison
    const { data: historicalMatches } = await supabase
      .from("matches")
      .select("operador_id, score, estado, local_id, locales(superficie_m2, precio_renta, ciudad)")
      .eq("estado", "exito")
      .order("updated_at", { ascending: false })
      .limit(200);

    // --- STEP 1: Rule-based scoring (same as before) ---
    const scored = operadores.map((op: any) => {
      let scoreBase = 0;
      const tags: string[] = [];
      const reasons: string[] = [];
      const factoresPositivos: string[] = [];
      const factoresNegativos: string[] = [];

      // Surface compatibility (40 points)
      const supLocal = Number(local.superficie_m2);
      const supMin = Number(op.superficie_min);
      const supMax = Number(op.superficie_max);
      
      if (supMax > 0 && supLocal >= supMin && supLocal <= supMax) {
        scoreBase += 40;
        tags.push("superficie_compatible");
        reasons.push(`Superficie ${supLocal}m² dentro del rango ${supMin}-${supMax}m²`);
        factoresPositivos.push("Superficie perfectamente compatible");
      } else if (supMax > 0) {
        const minDist = Math.min(Math.abs(supLocal - supMin), Math.abs(supLocal - supMax));
        const maxRange = Math.max(supMax, supLocal);
        const partial = Math.max(0, 40 - (minDist / (maxRange || 1)) * 40);
        scoreBase += Math.round(partial);
        if (partial > 20) {
          tags.push("superficie_parcial");
          factoresPositivos.push("Superficie cercana al rango ideal");
        } else {
          factoresNegativos.push(`Superficie ${supLocal}m² fuera del rango preferido`);
        }
      } else {
        scoreBase += 20;
      }

      // Budget compatibility (40 points)
      const rentaLocal = Number(local.precio_renta);
      const presMin = Number(op.presupuesto_min);
      const presMax = Number(op.presupuesto_max);

      if (presMax > 0 && rentaLocal >= presMin && rentaLocal <= presMax) {
        scoreBase += 40;
        tags.push("presupuesto_compatible");
        reasons.push(`Renta ${rentaLocal}€ dentro del presupuesto ${presMin}-${presMax}€`);
        factoresPositivos.push("Presupuesto perfectamente alineado");
      } else if (presMax > 0) {
        const minDist = Math.min(Math.abs(rentaLocal - presMin), Math.abs(rentaLocal - presMax));
        const maxRange = Math.max(presMax, rentaLocal);
        const partial = Math.max(0, 40 - (minDist / (maxRange || 1)) * 40);
        scoreBase += Math.round(partial);
        if (partial > 20) {
          tags.push("presupuesto_parcial");
          factoresPositivos.push("Presupuesto cercano al rango");
        } else {
          factoresNegativos.push(`Renta ${rentaLocal}€ fuera del presupuesto`);
        }
      } else {
        scoreBase += 20;
      }

      // Sector bonus (10 points base)
      const sector = (op.sector || "").toLowerCase();
      scoreBase += 10;
      tags.push("sector_" + sector.replace(/\s/g, "_"));

      // AI profile bonus
      if (op.perfil_ia) {
        scoreBase += 5;
        tags.push("perfil_ia");
        factoresPositivos.push("Operador con perfil IA enriquecido");
      }

      // --- STEP 2: Apply learned pattern adjustments ---
      let ajusteHistorico = 0;
      let ajusteFeedback = 0;
      let ajusteSector = 0;
      let ajusteZona = 0;

      // Sector + Surface pattern
      const surfaceRange = getSurfaceRange(supLocal);
      const sectorSurfacePattern = patternMap.get(`match_preference:sector:${sector}+superficie:${surfaceRange}`);
      if (sectorSurfacePattern) {
        ajusteHistorico += sectorSurfacePattern.score_ajuste;
        if (sectorSurfacePattern.tasa_exito > 0.6) {
          factoresPositivos.push(`Patrón exitoso: ${sector} en ${surfaceRange}m² (${Math.round(sectorSurfacePattern.tasa_exito * 100)}% éxito)`);
        }
      }

      // Sector success rate pattern
      const sectorPattern = patternMap.get(`sector_success_rate:sector:${sector}`);
      if (sectorPattern) {
        ajusteSector += Math.round(sectorPattern.tasa_exito * 10 - 5); // -5 to +5
        if (sectorPattern.tasa_exito > 0.7) {
          factoresPositivos.push(`Sector ${op.sector} con alta tasa de éxito histórica`);
        }
      }

      // Zone pattern
      if (local.ciudad) {
        const zonePattern = patternMap.get(`sector_affinity:zona:${local.ciudad.toLowerCase()}+sector:${sector}`);
        if (zonePattern) {
          ajusteZona += zonePattern.score_ajuste;
          if (zonePattern.tasa_exito > 0.6) {
            factoresPositivos.push(`${op.sector} funciona bien en ${local.ciudad}`);
          }
        }
      }

      // --- STEP 3: Find similar historical matches ---
      const comparables: any[] = [];
      let probabilidadExito = 0.5;

      if (historicalMatches) {
        const similar = historicalMatches.filter((m: any) => {
          if (m.operador_id !== op.id) return false;
          const mLocal = m.locales;
          if (!mLocal) return false;
          const surfDiff = Math.abs(mLocal.superficie_m2 - supLocal) / supLocal;
          const priceDiff = Math.abs(mLocal.precio_renta - rentaLocal) / rentaLocal;
          return surfDiff < 0.3 && priceDiff < 0.3;
        });

        if (similar.length > 0) {
          comparables.push(...similar.slice(0, 3).map((m: any) => ({
            local_id: m.local_id,
            score: m.score,
            superficie: m.locales?.superficie_m2,
            renta: m.locales?.precio_renta,
          })));

          // Boost probability based on similar successes
          probabilidadExito = Math.min(0.9, 0.5 + (similar.length * 0.1));
          ajusteHistorico += similar.length * 3;
          factoresPositivos.push(`${similar.length} casos similares exitosos con este operador`);
        }
      }

      // Calculate final score
      const totalAjuste = ajusteHistorico + ajusteFeedback + ajusteSector + ajusteZona;
      const scoreAjustado = Math.min(100, Math.max(0, scoreBase + totalAjuste));

      // Predictive score (weighted combination)
      const scorePredictivo = Math.round(
        scoreAjustado * 0.6 + 
        probabilidadExito * 100 * 0.4
      );

      const scoreFinal = Math.min(100, scorePredictivo);

      return {
        operador_id: op.id,
        operador_nombre: op.nombre,
        operador_sector: op.sector,
        score_base: scoreBase,
        score_ajustado: scoreAjustado,
        score_predictivo: scorePredictivo,
        score_final: scoreFinal,
        ajuste_historico: ajusteHistorico,
        ajuste_feedback: ajusteFeedback,
        ajuste_sector: ajusteSector,
        ajuste_zona: ajusteZona,
        probabilidad_exito: probabilidadExito,
        tags,
        reasons,
        factores_positivos: factoresPositivos,
        factores_negativos: factoresNegativos,
        comparables_usados: comparables,
      };
    });

    // Top matches by final score
    const topMatches = scored
      .sort((a: any, b: any) => b.score_final - a.score_final)
      .filter((m: any) => m.score_final > 20)
      .slice(0, 15);

    // --- STEP 4: AI-powered explanations ---
    let aiExplanations: Record<string, string> = {};
    let modelo = "predictive-v4";
    let tokensIn = 0;
    let tokensOut = 0;
    let aiCost = 0;

    if (lovableApiKey && topMatches.length > 0) {
      try {
        const prompt = `Eres un experto en retail inmobiliario. Analiza estos matches PREDICTIVOS entre un local y operadores.

LOCAL:
- Nombre: ${local.nombre}
- Dirección: ${local.direccion}, ${local.ciudad}
- Superficie: ${local.superficie_m2} m²
- Renta: ${local.precio_renta} €/mes

MATCHES (ordenados por score predictivo):
${topMatches.slice(0, 8).map((m: any, i: number) => `${i + 1}. ${m.operador_nombre} (${m.operador_sector})
   Score final: ${m.score_final}% (base: ${m.score_base}, ajustado: +${m.ajuste_historico + m.ajuste_sector + m.ajuste_zona})
   Probabilidad éxito: ${Math.round(m.probabilidad_exito * 100)}%
   Factores+: ${m.factores_positivos.join(", ") || "N/A"}
   Factores-: ${m.factores_negativos.join(", ") || "N/A"}
   Comparables: ${m.comparables_usados.length} casos similares exitosos`).join("\n\n")}

Para cada match, genera una explicación CONCISA (2 frases máximo) que destaque por qué el modelo predice este resultado, mencionando el aprendizaje histórico cuando sea relevante.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            messages: [
              { role: "system", content: "Eres un asistente de retail inmobiliario. Responde SOLO con JSON array: [{operador_nombre, explicacion}]. Sin markdown." },
              { role: "user", content: prompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "provide_predictions",
                description: "Provide AI predictions with explanations",
                parameters: {
                  type: "object",
                  properties: {
                    predictions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          operador_nombre: { type: "string" },
                          explicacion: { type: "string" },
                        },
                        required: ["operador_nombre", "explicacion"],
                      },
                    },
                  },
                  required: ["predictions"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "provide_predictions" } },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          modelo = "predictive-v4+gemini-2.0-flash-001";
          tokensIn = aiData.usage?.prompt_tokens || 0;
          tokensOut = aiData.usage?.completion_tokens || 0;
          aiCost = (tokensIn * 0.000001 + tokensOut * 0.000004);

          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            for (const p of parsed.predictions || []) {
              aiExplanations[p.operador_nombre] = p.explicacion;
            }
          }
        }
      } catch (aiError) {
        console.error("AI error:", aiError);
      }
    }

    // --- STEP 5: Insert matches + predictions ---
    const matchInserts = topMatches.map((m: any) => ({
      local_id,
      operador_id: m.operador_id,
      score: m.score_final,
      explicacion: aiExplanations[m.operador_nombre] || 
        `Score ${m.score_final}% (prob. éxito: ${Math.round(m.probabilidad_exito * 100)}%). ${m.factores_positivos.slice(0, 2).join(". ")}`,
      tags: m.tags,
      estado: m.score_final >= 75 ? "sugerido" : "pendiente",
      generado_por: user.id,
    }));

    const { data: insertedMatches, error: insertError } = await supabase
      .from("matches")
      .insert(matchInserts)
      .select();

    // Insert predictions
    const predictionInserts = topMatches.map((m: any) => ({
      local_id,
      operador_id: m.operador_id,
      score_base: m.score_base,
      score_ajustado: m.score_ajustado,
      score_predictivo: m.score_predictivo,
      score_final: m.score_final,
      ajuste_historico: m.ajuste_historico,
      ajuste_feedback: m.ajuste_feedback,
      ajuste_sector: m.ajuste_sector,
      ajuste_zona: m.ajuste_zona,
      probabilidad_exito: m.probabilidad_exito,
      factores_positivos: m.factores_positivos,
      factores_negativos: m.factores_negativos,
      comparables_usados: m.comparables_usados,
    }));

    await supabase.from("match_predictions").upsert(predictionInserts, {
      onConflict: "local_id,operador_id",
    });

    const latency = Date.now() - startTime;

    // Audit log
    await supabase.from("auditoria_ia").insert({
      local_id,
      modelo,
      funcion_ia: "matching_v4",
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
        predictions: topMatches.map((m: any) => ({
          operador: m.operador_nombre,
          score_final: m.score_final,
          probabilidad_exito: m.probabilidad_exito,
          factores_positivos: m.factores_positivos,
          comparables: m.comparables_usados.length,
        })),
        latency_ms: latency,
        modelo,
        patterns_applied: patternMap.size,
        ai_enhanced: Object.keys(aiExplanations).length > 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("generate-match-v4 error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getSurfaceRange(m2: number): string {
  if (m2 < 50) return "0-50";
  if (m2 < 100) return "50-100";
  if (m2 < 200) return "100-200";
  if (m2 < 500) return "200-500";
  return "500+";
}
