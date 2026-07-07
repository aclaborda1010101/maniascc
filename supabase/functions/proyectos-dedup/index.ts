import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tablas con columna proyecto_id que se repuntan al fusionar
const TABLAS_FK_PROYECTO = [
  "actividad_proyecto",
  "activos",
  "ai_insights",
  "documentos_generados",
  "documentos_proyecto",
  "negociaciones",
  "project_aliases",
  "proyecto_contactos",
  "proyecto_equipo",
  "proyecto_operadores",
  "document_chunks",
];

// Normalización JS espejo de la SQL normalize_project_key (para agrupar en memoria)
function normalizeKey(t: string | null | undefined): string {
  if (!t) return "";
  let s = t.toLowerCase().trim();
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[—–−-]/g, "-");
  s = s.replace(/[.,;:'"`]/g, " ");
  s = s.replace(/\b(centro comercial)\b/g, "cc");
  s = s.replace(/\bc\s*c\b/g, "cc");
  s = s.replace(/\bavenida\b/g, "av");
  s = s.replace(/\bav\b/g, "av");
  s = s.replace(/\bcalle\b/g, "calle");
  s = s.replace(/\bc\s*\//g, "calle ");
  s = s.replace(/\s*-\s*/g, "-");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function normText(t: string | null | undefined): string {
  return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // === Nueva acción unificada: detectar candidatos + mismo-marca-distintos ===
    if (action === "detectar" || action === "detectar_duplicados_reales" || action === "detectar_mismo_nombre_distintos") {
      const { data: rows, error } = await admin
        .from("proyectos")
        .select("id, nombre, descripcion, ubicacion, metadata, created_at, merge_status, dedup_status")
        .eq("merge_status", "activo")
        .order("created_at", { ascending: true })
        .limit(10000);
      if (error) throw error;

      // Agrupar por clave normalizada
      const byKey = new Map<string, any[]>();
      for (const r of rows || []) {
        const key = normalizeKey(r.nombre);
        if (!key) continue;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(r);
      }

      const candidatos: any[] = []; // duplicate_candidate (alta confianza)
      const mismaMarca: any[] = []; // informativo (operaciones distintas)

      for (const [key, group] of byKey.entries()) {
        if (group.length <= 1) continue;

        // Filtramos los ya marcados not_duplicate del análisis de candidato,
        // pero los mantenemos visibles en "misma marca"
        const activos = group.filter((g) => g.dedup_status !== "not_duplicate");

        // Sub-agrupar por (descripcion, comision) normalizados dentro de la misma clave
        const bySig = new Map<string, any[]>();
        for (const r of activos) {
          const comision = (r.metadata as any)?.["Total Comisión"] ?? "";
          const sig = `${normText(r.descripcion)}||${normText(String(comision))}`;
          if (!bySig.has(sig)) bySig.set(sig, []);
          bySig.get(sig)!.push(r);
        }

        // Cada sub-grupo con >1 = duplicado real de alta confianza
        for (const [, subg] of bySig.entries()) {
          if (subg.length > 1) {
            subg.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const canonical = subg[0];
            const duplicates = subg.slice(1);
            candidatos.push({
              key: `${key}::${canonical.id}`,
              norm_key: key,
              confidence: "alta",
              evidencia: "nombre normalizado + descripción + comisión idénticos",
              canonical: {
                id: canonical.id, nombre: canonical.nombre,
                descripcion: canonical.descripcion, created_at: canonical.created_at,
                comision_total: (canonical.metadata as any)?.["Total Comisión"] ?? null,
              },
              duplicates: duplicates.map((d) => ({
                id: d.id, nombre: d.nombre, descripcion: d.descripcion,
                comision_total: (d.metadata as any)?.["Total Comisión"] ?? null,
                created_at: d.created_at,
              })),
              total: subg.length,
            });
          }
        }

        // Si hay MÁS de una firma distinta bajo la misma clave normalizada → misma marca, operaciones distintas
        const firmasDistintas = Array.from(bySig.keys()).filter((_, i, arr) => arr.length > 1);
        if (firmasDistintas.length > 0 && group.length > 1) {
          mismaMarca.push({
            norm_key: key,
            nombre_ejemplo: group[0].nombre,
            total: group.length,
            items: group.map((x) => ({
              id: x.id,
              nombre: x.nombre,
              descripcion: x.descripcion,
              ubicacion: x.ubicacion,
              comision_total: (x.metadata as any)?.["Total Comisión"] ?? null,
              dedup_status: x.dedup_status,
            })),
          });
        }
      }

      candidatos.sort((a, b) => b.total - a.total);
      mismaMarca.sort((a, b) => b.total - a.total);

      // Contadores por dedup_status
      const contadores = { sin_revisar: 0, duplicate_candidate: 0, confirmed_duplicate: 0, not_duplicate: 0 };
      for (const r of rows || []) {
        const st = (r.dedup_status || "sin_revisar") as keyof typeof contadores;
        if (st in contadores) contadores[st]++;
      }

      // Marcar en BD como duplicate_candidate los que aún estén sin_revisar
      const idsCandidato = new Set<string>();
      for (const g of candidatos) {
        idsCandidato.add(g.canonical.id);
        for (const d of g.duplicates) idsCandidato.add(d.id);
      }
      if (idsCandidato.size > 0) {
        await admin.from("proyectos")
          .update({ dedup_status: "duplicate_candidate" })
          .in("id", Array.from(idsCandidato))
          .eq("dedup_status", "sin_revisar");
      }

      return new Response(JSON.stringify({
        candidatos,
        misma_marca_distintos: mismaMarca,
        total_candidatos: candidatos.length,
        total_misma_marca: mismaMarca.length,
        contadores,
        // compat con UI antigua
        grupos: action === "detectar_mismo_nombre_distintos"
          ? mismaMarca.map((m) => ({ nombre: m.nombre_ejemplo, total: m.total, items: m.items }))
          : candidatos.map((c) => ({
              key: c.key, canonical: c.canonical, duplicates: c.duplicates,
              nombre: c.canonical.nombre, descripcion: c.canonical.descripcion,
              comision_total: c.canonical.comision_total, total: c.total,
            })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "confirmar_duplicado" || action === "fusionar") {
      const canonical_id: string = body.canonical_id;
      const duplicate_ids: string[] = body.duplicate_ids || [];
      if (!canonical_id || duplicate_ids.length === 0) {
        return new Response(JSON.stringify({ error: "canonical_id y duplicate_ids requeridos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (duplicate_ids.includes(canonical_id)) {
        return new Response(JSON.stringify({ error: "canonical_id no puede estar en duplicate_ids" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const repunteadas: Record<string, number> = {};
      for (const tabla of TABLAS_FK_PROYECTO) {
        const { data, error } = await admin
          .from(tabla)
          .update({ proyecto_id: canonical_id })
          .in("proyecto_id", duplicate_ids)
          .select("proyecto_id");
        if (error) {
          console.warn(`[fusionar] fallo en ${tabla}:`, error.message);
          repunteadas[tabla] = -1;
        } else {
          repunteadas[tabla] = (data || []).length;
        }
      }

      const { error: e2 } = await admin
        .from("proyectos")
        .update({
          merge_status: "fusionado",
          canonical_project_id: canonical_id,
          dedup_status: "confirmed_duplicate",
        })
        .in("id", duplicate_ids);
      if (e2) {
        return new Response(JSON.stringify({ error: e2.message, repunteadas }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // El canónico queda marcado como confirmed_duplicate (grupo revisado, canónico)
      await admin.from("proyectos")
        .update({ dedup_status: "confirmed_duplicate" })
        .eq("id", canonical_id);

      return new Response(JSON.stringify({
        success: true, canonical_id, fusionados: duplicate_ids.length, repunteadas,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "marcar_no_duplicado") {
      const ids: string[] = body.ids || [];
      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: "ids requerido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await admin
        .from("proyectos")
        .update({ dedup_status: "not_duplicate" })
        .in("id", ids);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, actualizados: ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "desambiguar") {
      const ids: string[] = body.ids || [];
      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: "ids requerido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: rows } = await admin
        .from("proyectos")
        .select("id, nombre, descripcion, ubicacion")
        .in("id", ids);
      let actualizados = 0;
      for (const r of rows || []) {
        const sufijo = (r.ubicacion || (r.descripcion || "").slice(0, 40)).trim();
        if (!sufijo) continue;
        if ((r.nombre || "").includes("—")) continue;
        const nuevoNombre = `${r.nombre} — ${sufijo}`;
        const { error } = await admin.from("proyectos").update({ nombre: nuevoNombre }).eq("id", r.id);
        if (!error) actualizados++;
      }
      return new Response(JSON.stringify({ success: true, actualizados }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action no soportada" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("proyectos-dedup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
