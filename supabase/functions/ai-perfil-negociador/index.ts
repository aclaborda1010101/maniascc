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

    const { contacto_nombre, contacto_empresa, contacto_cargo, contexto_deal, notas_previas } = await req.json();
    if (!contacto_nombre) throw new Error("Nombre del contacto requerido");

    const startTime = Date.now();

    // Check existing profile
    const { data: existingProfile } = await supabase
      .from("perfiles_negociador")
      .select("*")
      .eq("contacto_nombre", contacto_nombre)
      .maybeSingle();

    // Get negotiation history
    let historico: any[] = [];
    if (existingProfile) {
      const { data } = await supabase
        .from("negociaciones_historico")
        .select("*")
        .eq("interlocutor_perfil_id", existingProfile.id)
        .order("creado_en", { ascending: false })
        .limit(10);
      historico = data || [];
    }

    const prompt = `Eres AVA TURING PULSE, experto en psicología de negociación inmobiliaria. Genera un briefing pre-reunión para negociar con:

Contacto: ${contacto_nombre}${contacto_empresa ? ` de ${contacto_empresa}` : ""}${contacto_cargo ? ` (${contacto_cargo})` : ""}
${contexto_deal ? `Contexto del deal: ${contexto_deal}` : ""}
${notas_previas ? `Notas previas: ${notas_previas}` : ""}
${existingProfile ? `Perfil existente: estilo ${existingProfile.estilo_primario}, ${existingProfile.historico_resumen || "sin historial previo"}` : "Sin perfil previo"}
${historico.length > 0 ? `Historial: ${JSON.stringify(historico.map(h => ({ resultado: h.resultado, duracion: h.duracion_dias, notas: h.notas })))}` : "Sin historial de negociaciones"}

Clasifica al negociador según: competitivo, colaborativo, analítico, expresivo, evitador.
Genera recomendaciones tácticas específicas.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "Eres ATLAS PULSE, agente de inteligencia de negociación. RGPD: solo procesar datos con base legal legítima. Responde SOLO con tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "negotiator_profile",
            description: "Perfil y briefing de negociador",
            parameters: {
              type: "object",
              properties: {
                estilo_primario: { type: "string", enum: ["competitivo", "colaborativo", "analitico", "expresivo", "evitador"] },
                estilo_secundario: { type: "string", enum: ["competitivo", "colaborativo", "analitico", "expresivo", "evitador"] },
                puntos_flexion: { type: "array", items: { type: "object", properties: { punto: { type: "string" }, importancia: { type: "string" } }, required: ["punto", "importancia"] } },
                fortalezas: { type: "array", items: { type: "string" } },
                debilidades: { type: "array", items: { type: "string" } },
                recomendacion_apertura: { type: "string" },
                talking_points: { type: "array", items: { type: "string" } },
                que_evitar: { type: "array", items: { type: "string" } },
                probabilidad_cierre: { type: "number" },
                formato_preferido: { type: "string", enum: ["presencial", "remoto", "hibrido"] },
                historico_resumen: { type: "string" },
              },
              required: ["estilo_primario", "puntos_flexion", "recomendacion_apertura", "talking_points", "que_evitar", "probabilidad_cierre", "historico_resumen"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "negotiator_profile" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Límite de peticiones excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos agotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Error del gateway IA");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let profile;
    if (toolCall?.function?.arguments) {
      profile = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    } else {
      throw new Error("No se pudo generar perfil");
    }

    const latencyMs = Date.now() - startTime;

    // Upsert profile
    if (existingProfile) {
      await supabase.from("perfiles_negociador").update({
        estilo_primario: profile.estilo_primario,
        estilo_secundario: profile.estilo_secundario || null,
        puntos_flexion: profile.puntos_flexion,
        historico_resumen: profile.historico_resumen,
        actualizado_en: new Date().toISOString(),
      }).eq("id", existingProfile.id);
    } else {
      await supabase.from("perfiles_negociador").insert({
        contacto_nombre, contacto_empresa, contacto_cargo,
        estilo_primario: profile.estilo_primario,
        estilo_secundario: profile.estilo_secundario || null,
        puntos_flexion: profile.puntos_flexion,
        historico_resumen: profile.historico_resumen,
        usuario_id: user.id,
      });
    }

    await supabase.from("auditoria_ia").insert({
      modelo: "google/gemini-2.5-pro",
      funcion_ia: "perfil-negociador",
      latencia_ms: latencyMs,
      exito: true,
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      coste_estimado: 0.08,
      created_by: user.id,
    });

    return new Response(JSON.stringify({ ...profile, latencia_ms: latencyMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("perfil-negociador error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
