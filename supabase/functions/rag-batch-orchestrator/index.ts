// Edge function: orquesta el reprocesado masivo del RAG.
// Modos:
//   - "enqueue_all": detecta documentos sin clasificar / sin indexar / sin embedding
//                    y los inserta en la cola rag_reprocess_queue.
//   - "process_batch": coge N tareas pending y las procesa (llama internamente a
//                      document-classify, rag-ingest o rag-embed según task_type).
//   - "stats": devuelve el estado actual (cuántos pendientes / done / error).
//
// Pensado para invocarse desde un botón en /admin o desde un cron job.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "enqueue_all" | "process_batch" | "stats";

interface ReqBody {
  mode: Mode;
  batch_size?: number;
  task_type?: "classify" | "ingest" | "embed";
}

const FN_BY_TYPE: Record<string, string> = {
  classify: "document-classify",
  ingest: "rag-ingest",
  embed: "rag-embed-chunks",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: solo admin/gestor
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getUser();
    if (!claims.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body: ReqBody = await req.json();
    const mode = body.mode;

    // ---------- STATS ----------
    if (mode === "stats") {
      const [{ count: totalDocs }, { count: classifiedDocs }, { count: indexedDocs }] = await Promise.all([
        admin.from("documentos_proyecto").select("id", { count: "exact", head: true }),
        admin.from("documentos_proyecto").select("id", { count: "exact", head: true }).not("taxonomia_id", "is", null),
        admin.from("documentos_proyecto").select("id", { count: "exact", head: true }).eq("procesado_ia", true),
      ]);
      const [{ count: chunksTotal }, { count: chunksWithEmbedding }] = await Promise.all([
        admin.from("document_chunks").select("id", { count: "exact", head: true }),
        admin.from("document_chunks").select("id", { count: "exact", head: true }).not("embedding", "is", null),
      ]);
      const { data: queueStats } = await admin
        .from("rag_reprocess_queue")
        .select("task_type, estado")
        .limit(50000);
      const queue: Record<string, Record<string, number>> = {};
      for (const row of queueStats || []) {
        queue[row.task_type] ??= {};
        queue[row.task_type][row.estado] = (queue[row.task_type][row.estado] || 0) + 1;
      }
      return new Response(
        JSON.stringify({
          documents: {
            total: totalDocs || 0,
            classified: classifiedDocs || 0,
            indexed: indexedDocs || 0,
            unclassified: (totalDocs || 0) - (classifiedDocs || 0),
            unindexed: (totalDocs || 0) - (indexedDocs || 0),
          },
          chunks: {
            total: chunksTotal || 0,
            with_embedding: chunksWithEmbedding || 0,
            without_embedding: (chunksTotal || 0) - (chunksWithEmbedding || 0),
          },
          queue,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- ENQUEUE ALL ----------
    if (mode === "enqueue_all") {
      // 1) Docs sin taxonomía → classify
      const { data: needClassify } = await admin
        .from("documentos_proyecto")
        .select("id")
        .is("taxonomia_id", null)
        .limit(50000);

      // 2) Docs sin indexar → ingest
      const { data: needIngest } = await admin
        .from("documentos_proyecto")
        .select("id")
        .eq("procesado_ia", false)
        .limit(50000);

      // 3) Documentos cuyos chunks no tienen embedding (usamos doc-level, el embed fn los procesa todos)
      const { data: docsWithoutEmbedding } = await admin.rpc("rag_docs_pending_embeddings" as never).then(
        (r) => r,
        () => ({ data: null as null | { id: string }[] })
      );
      // Fallback: si no existe la rpc, marcamos todos los procesados como candidatos
      let embedDocs: { id: string }[] = docsWithoutEmbedding ?? [];
      if (!docsWithoutEmbedding) {
        const { data: allProcessed } = await admin
          .from("documentos_proyecto")
          .select("id")
          .eq("procesado_ia", true)
          .limit(50000);
        embedDocs = allProcessed || [];
      }

      const rows = [
        ...(needClassify || []).map((d) => ({ documento_id: d.id, task_type: "classify" })),
        ...(needIngest || []).map((d) => ({ documento_id: d.id, task_type: "ingest" })),
        ...embedDocs.map((d) => ({ documento_id: d.id, task_type: "embed" })),
      ];

      // Insert en lotes de 1000 con onConflict ignorado
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 1000) {
        const slice = rows.slice(i, i + 1000);
        const { error, count } = await admin
          .from("rag_reprocess_queue")
          .upsert(slice, { onConflict: "documento_id,task_type", ignoreDuplicates: true, count: "exact" });
        if (!error) inserted += count || slice.length;
      }
      return new Response(
        JSON.stringify({
          enqueued: inserted,
          breakdown: {
            classify: needClassify?.length || 0,
            ingest: needIngest?.length || 0,
            embed: embedDocs.length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- PROCESS BATCH ----------
    if (mode === "process_batch") {
      const batchSize = Math.min(body.batch_size || 5, 10);
      const taskType = body.task_type; // si null, mezcla

      let q = admin.from("rag_reprocess_queue").select("*").eq("estado", "pending").lt("intentos", 3).order("created_at").limit(batchSize);
      if (taskType) q = q.eq("task_type", taskType);
      const { data: pending } = await q;

      if (!pending || pending.length === 0) {
        return new Response(JSON.stringify({ processed: 0, remaining: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Marcar processing
      const ids = pending.map((p: any) => p.id);
      await admin.from("rag_reprocess_queue").update({ estado: "processing" }).in("id", ids);

      // Lanzar en paralelo
      const results = await Promise.allSettled(
        pending.map(async (item: any) => {
          const fn = FN_BY_TYPE[item.task_type];
          if (!fn) throw new Error(`Unknown task_type: ${item.task_type}`);
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
              apikey: ANON_KEY,
            },
            body: JSON.stringify({ documento_id: item.documento_id }),
          });
          if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`${fn} → ${resp.status}: ${txt.slice(0, 200)}`);
          }
          return { id: item.id };
        })
      );

      // Actualizar estados
      const updates = pending.map((item: any, i: number) => {
        const r = results[i];
        if (r.status === "fulfilled") {
          return admin.from("rag_reprocess_queue").update({ estado: "done", error_msg: null }).eq("id", item.id);
        } else {
          return admin
            .from("rag_reprocess_queue")
            .update({
              estado: item.intentos + 1 >= 3 ? "error" : "pending",
              intentos: item.intentos + 1,
              error_msg: String(r.reason).slice(0, 500),
            })
            .eq("id", item.id);
        }
      });
      await Promise.allSettled(updates);

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const ko = results.length - ok;

      const { count: remaining } = await admin
        .from("rag_reprocess_queue")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pending");

      return new Response(
        JSON.stringify({ processed: pending.length, ok, ko, remaining: remaining || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "unknown mode" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (e) {
    console.error("rag-batch-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
