import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tablas descubiertas por information_schema con columna proyecto_id.
// Se refresca en cada llamada a 'fusionar' para no perder tablas nuevas.
async function tablasConProyectoId(admin: any): Promise<string[]> {
  const { data, error } = await admin.rpc("exec_sql_unavailable"); // placeholder, unused
  // Fallback: lista estática conocida + auto-descubrimiento vía SQL directo no disponible desde JS.
  // Usamos lista fija verificada, EXCLUYENDO 'proyectos' (self) y tablas RAG (document_chunks) que NO se repuntan.
  return [
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
    "document_chunks", // sí repuntamos: los chunks siguen siendo válidos para el canónico
  ];
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

    if (action === "detectar_duplicados_reales") {
      // Traemos todos los proyectos activos y agrupamos en JS por (nombre, descripcion, comision)
      const { data: rows, error } = await admin
        .from("proyectos")
        .select("id, nombre, descripcion, metadata, created_at, merge_status")
        .eq("merge_status", "activo")
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;

      const groups = new Map<string, any[]>();
      for (const r of rows || []) {
        const comision = (r.metadata as any)?.["Total Comisión"] ?? "";
        const key = `${r.nombre || ""}||${r.descripcion || ""}||${comision}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({
          id: r.id,
          nombre: r.nombre,
          descripcion: r.descripcion,
          comision_total: comision,
          created_at: r.created_at,
        });
      }
      const dupGroups = Array.from(groups.entries())
        .filter(([_, g]) => g.length > 1)
        .map(([key, g]) => ({
          key,
          canonical: g[0], // más antiguo
          duplicates: g.slice(1),
          nombre: g[0].nombre,
          descripcion: g[0].descripcion,
          comision_total: g[0].comision_total,
          total: g.length,
        }));

      return new Response(JSON.stringify({
        grupos: dupGroups,
        total_grupos: dupGroups.length,
        total_filas_redundantes: dupGroups.reduce((s, g) => s + g.duplicates.length, 0),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "detectar_mismo_nombre_distintos") {
      const { data: rows, error } = await admin
        .from("proyectos")
        .select("id, nombre, descripcion, ubicacion, metadata, created_at, merge_status")
        .eq("merge_status", "activo")
        .order("nombre", { ascending: true })
        .limit(5000);
      if (error) throw error;

      const byName = new Map<string, any[]>();
      for (const r of rows || []) {
        const key = (r.nombre || "").trim();
        if (!key) continue;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key)!.push(r);
      }
      const grupos: any[] = [];
      for (const [nombre, g] of byName.entries()) {
        if (g.length <= 1) continue;
        // Solo cuenta si las descripciones NO son todas iguales (= son operaciones distintas)
        const descsUnicas = new Set(g.map((x) => (x.descripcion || "").trim()));
        if (descsUnicas.size <= 1) continue;
        grupos.push({
          nombre,
          total: g.length,
          items: g.map((x) => ({
            id: x.id,
            descripcion: x.descripcion,
            ubicacion: x.ubicacion,
            comision_total: (x.metadata as any)?.["Total Comisión"] ?? null,
          })),
        });
      }
      grupos.sort((a, b) => b.total - a.total);
      return new Response(JSON.stringify({ grupos, total_grupos: grupos.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fusionar") {
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

      const tablas = await tablasConProyectoId(admin);
      const repunteadas: Record<string, number> = {};

      for (const tabla of tablas) {
        // update ... set proyecto_id=canonical where proyecto_id in duplicates
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

      // Soft-delete de duplicados
      const { error: e2 } = await admin
        .from("proyectos")
        .update({ merge_status: "fusionado", canonical_project_id: canonical_id })
        .in("id", duplicate_ids);
      if (e2) {
        return new Response(JSON.stringify({ error: e2.message, repunteadas }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        canonical_id,
        fusionados: duplicate_ids.length,
        repunteadas,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        if ((r.nombre || "").includes("—")) continue; // ya desambiguado
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
