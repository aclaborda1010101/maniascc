import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AVA voice transcription.
 * Tries providers in order:
 *   1. Groq Whisper Large v3 Turbo (fastest, ~0.3-0.6s for 10s audio)
 *   2. OpenAI gpt-4o-transcribe (fallback)
 *   3. Lovable AI Gemini multimodal (last resort)
 *
 * Body: { audio_base64: string, mime_type?: string }
 * Returns: { text: string, provider: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No autorizado" }, 401);
    }
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
      return json({ error: "Body inválido" }, 400);
    }

    const { audio_base64, mime_type } = body;
    if (!audio_base64) return json({ error: "audio_base64 requerido" }, 400);

    const mt = (mime_type || "audio/webm").split(";")[0];
    const audioBytes = base64ToBytes(audio_base64);

    // ------- 1. GROQ (preferred) -------
    if (groqKey) {
      try {
        const ext = mtToExt(mt);
        const fd = new FormData();
        fd.append("file", new Blob([audioBytes], { type: mt }), `audio.${ext}`);
        fd.append("model", "whisper-large-v3-turbo");
        fd.append("language", "es");
        fd.append("response_format", "json");
        fd.append("temperature", "0");

        const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}` },
          body: fd,
        });
        if (r.ok) {
          const j = await r.json();
          const text = (j.text || "").trim();
          return json({ success: true, text, provider: "groq" });
        }
        const errBody = await r.text();
        console.error("Groq transcribe failed:", r.status, errBody.slice(0, 300));
        if (r.status === 429) {
          // try fallback
        }
      } catch (e) {
        console.error("Groq exception:", e);
      }
    }

    // ------- 2. OPENAI (fallback) -------
    if (openaiKey) {
      try {
        const ext = mtToExt(mt);
        const fd = new FormData();
        fd.append("file", new Blob([audioBytes], { type: mt }), `audio.${ext}`);
        fd.append("model", "gpt-4o-transcribe");
        fd.append("language", "es");

        const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: fd,
        });
        if (r.ok) {
          const j = await r.json();
          const text = (j.text || "").trim();
          return json({ success: true, text, provider: "openai" });
        }
        const errBody = await r.text();
        console.error("OpenAI transcribe failed:", r.status, errBody.slice(0, 300));
      } catch (e) {
        console.error("OpenAI exception:", e);
      }
    }

    // ------- 3. GEMINI (last resort) -------
    if (lovableKey) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Eres un transcriptor de audio profesional en español. Devuelve EXCLUSIVAMENTE la transcripción literal del audio." },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe este audio en español:" },
                { type: "image_url", image_url: { url: `data:${mt};base64,${audio_base64}` } },
              ],
            },
          ],
        }),
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const text = (aiData.choices?.[0]?.message?.content || "").trim();
        return json({ success: true, text, provider: "gemini" });
      }
      if (aiResp.status === 429) return json({ error: "Límite de uso alcanzado" }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos AI agotados" }, 402);
    }

    return json({ error: "No hay proveedor de transcripción disponible" }, 500);
  } catch (e) {
    console.error("ava-transcribe error:", e);
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function mtToExt(mt: string): string {
  if (mt.includes("webm")) return "webm";
  if (mt.includes("ogg")) return "ogg";
  if (mt.includes("mp4") || mt.includes("m4a")) return "m4a";
  if (mt.includes("mpeg") || mt.includes("mp3")) return "mp3";
  if (mt.includes("wav")) return "wav";
  if (mt.includes("flac")) return "flac";
  return "webm";
}
