import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Issues an ephemeral OpenAI Realtime API token for browser WebRTC sessions.
 * The browser must NEVER receive the long-lived OPENAI_API_KEY.
 *
 * Returns: { client_secret: { value, expires_at }, model, voice }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) return json({ error: "OPENAI_API_KEY no configurada" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) return json({ error: "No autorizado" }, 401);

    let body: any = {};
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }

    const model = body.model || "gpt-4o-realtime-preview-2024-12-17";
    const voice = body.voice || "alloy";

    const instructions = body.instructions || `Eres AVA, una asistente inteligente de F&G especializada en gestión inmobiliaria comercial.
Hablas en español de España con tono profesional pero cercano.
Sé breve y directa: respuestas cortas, frases naturales, evita listas largas en voz.
Si el usuario pide datos concretos del CRM, indica que tras colgar puedes consultarlo en el chat de texto.
No inventes datos. Si no sabes algo, dilo.`;

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        instructions,
        modalities: ["audio", "text"],
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
        },
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      console.error("OpenAI realtime session failed:", r.status, errBody.slice(0, 500));
      return json({ error: `OpenAI error ${r.status}: ${errBody.slice(0, 200)}` }, 500);
    }

    const data = await r.json();
    return json({
      success: true,
      client_secret: data.client_secret,
      model,
      voice,
    });
  } catch (e) {
    console.error("realtime-token error:", e);
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
