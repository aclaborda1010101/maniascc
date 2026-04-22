// Edge function: orquesta el backfill inicial y el delta incremental de OneDrive.
// Usa Microsoft Graph (delta query). Requiere conector microsoft_onedrive linkeado o secreto MS_GRAPH_TOKEN.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://connector-gateway.lovable.dev/microsoft_onedrive";

interface SyncRequest {
  user_id: string;
  mode: "backfill" | "delta";
  page_url?: string; // para reanudar
  max_items?: number; // límite por invocación (procesado por lotes)
}

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  file?: { mimeType?: string; hashes?: { quickXorHash?: string; sha1Hash?: string } };
  folder?: { childCount: number };
  parentReference?: { path?: string };
  lastModifiedDateTime?: string;
  webUrl?: string;
  deleted?: { state: string };
}

const SUPPORTED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "message/rfc822",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = userData.user.id;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body: SyncRequest = await req.json();
    if (!body.mode) {
      return new Response(JSON.stringify({ error: "mode requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Force user_id to authenticated user — never trust client-supplied user_id
    body.user_id = authUserId;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ONEDRIVE_API_KEY = Deno.env.get("MICROSOFT_ONEDRIVE_API_KEY");

    if (!LOVABLE_API_KEY || !ONEDRIVE_API_KEY) {
      return new Response(JSON.stringify({
        error: "Conector OneDrive no configurado. Conecta Microsoft OneDrive en Ajustes.",
        needs_connection: true,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Estado de sync
    const { data: state } = await supabase
      .from("onedrive_sync_state")
      .select("*")
      .eq("user_id", body.user_id)
      .maybeSingle();

    let syncState = state;
    if (!syncState) {
      const { data: created } = await supabase.from("onedrive_sync_state").insert({
        user_id: body.user_id,
        estado: body.mode,
      }).select().single();
      syncState = created;
    }

    // Crear job
    const { data: job } = await supabase.from("ingestion_jobs").insert({
      user_id: body.user_id,
      job_type: body.mode === "backfill" ? "onedrive_backfill" : "onedrive_delta",
      estado: "running",
      iniciado_en: new Date().toISOString(),
      config: { max_items: body.max_items || 200 },
    }).select().single();

    // Construir URL de Graph
    let url: string;
    if (body.page_url) {
      url = body.page_url;
    } else if (body.mode === "delta" && syncState?.delta_token) {
      url = `${GATEWAY}/v1.0/me/drive/root/delta?token=${syncState.delta_token}`;
    } else {
      url = `${GATEWAY}/v1.0/me/drive/root/delta`;
    }

    let processed = 0, failed = 0, skipped = 0;
    let nextLink: string | null = null;
    let deltaLink: string | null = null;
    const maxItems = body.max_items || 200;
    const errors: string[] = [];

    while (url && processed < maxItems) {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": ONEDRIVE_API_KEY,
        },
      });

      if (!resp.ok) {
        const txt = await resp.text();
        errors.push(`Graph error ${resp.status}: ${txt.slice(0, 200)}`);
        break;
      }

      const data: { value: DriveItem[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string } = await resp.json();

      for (const item of data.value || []) {
        if (processed >= maxItems) break;
        if (item.folder) { skipped++; continue; }
        if (item.deleted) {
          // Tombstone: marcar documento como eliminado si existe
          await supabase.from("documentos_proyecto")
            .update({ fase_rag: "skipped", metadata_extraida: { deleted_in_onedrive: true } })
            .eq("origen", "onedrive")
            .eq("origen_external_id", item.id);
          processed++;
          continue;
        }
        if (!item.file) { skipped++; continue; }

        const mime = item.file.mimeType || "application/octet-stream";
        const hash = item.file.hashes?.sha1Hash || item.file.hashes?.quickXorHash || null;

        // Deduplicación por external_id o hash
        const { data: existing } = await supabase
          .from("documentos_proyecto")
          .select("id")
          .or(`origen_external_id.eq.${item.id}${hash ? `,hash_md5.eq.${hash}` : ""}`)
          .maybeSingle();

        if (existing) { skipped++; processed++; continue; }

        const isSupported = SUPPORTED_TYPES.has(mime) || mime.startsWith("image/");
        const fase: string = isSupported ? "queued" : "skipped";

        const { error: insErr } = await supabase.from("documentos_proyecto").insert({
          nombre: item.name,
          mime_type: mime,
          tamano_bytes: item.size || 0,
          storage_path: `onedrive://${item.id}`,
          owner_id: body.user_id,
          subido_por: body.user_id,
          visibility: "private",
          origen: "onedrive",
          origen_external_id: item.id,
          hash_md5: hash,
          fecha_documento: item.lastModifiedDateTime || null,
          fase_rag: fase,
          metadata_extraida: {
            web_url: item.webUrl,
            parent_path: item.parentReference?.path,
          },
        });

        if (insErr) { failed++; errors.push(insErr.message); }
        processed++;
      }

      nextLink = data["@odata.nextLink"] || null;
      deltaLink = data["@odata.deltaLink"] || null;
      if (nextLink && processed < maxItems) {
        url = nextLink;
      } else {
        break;
      }
    }

    // Extraer delta token
    let newDeltaToken = syncState?.delta_token || null;
    if (deltaLink) {
      const tokenMatch = deltaLink.match(/token=([^&]+)/);
      if (tokenMatch) newDeltaToken = decodeURIComponent(tokenMatch[1]);
    }

    // Actualizar estado
    await supabase.from("onedrive_sync_state").update({
      delta_token: newDeltaToken,
      estado: nextLink ? body.mode : "idle",
      ultimo_backfill: body.mode === "backfill" ? new Date().toISOString() : syncState?.ultimo_backfill,
      ultimo_delta: body.mode === "delta" ? new Date().toISOString() : syncState?.ultimo_delta,
      total_archivos: (syncState?.total_archivos || 0) + processed - skipped,
      ultimo_error: errors.length ? errors[0] : null,
    }).eq("user_id", body.user_id);

    await supabase.from("ingestion_jobs").update({
      estado: nextLink ? "running" : "completed",
      processed_items: processed,
      failed_items: failed,
      skipped_items: skipped,
      total_items: processed,
      completado_en: nextLink ? null : new Date().toISOString(),
      resumen: { errors: errors.slice(0, 10) },
      ultimo_error: errors[0] || null,
    }).eq("id", job!.id);

    return new Response(JSON.stringify({
      ok: true,
      processed, failed, skipped,
      next_page_url: nextLink,
      has_more: !!nextLink,
      delta_token: newDeltaToken,
      job_id: job!.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
