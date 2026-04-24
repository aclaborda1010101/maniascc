import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = [
  "contactos",
  "operadores",
  "activos",
  "locales",
  "proyectos",
  "negociaciones",
  "matches",
  "entity_narratives",
];

const FORBIDDEN_FIELDS = ["id", "created_at", "updated_at"];

const CREATOR_COLUMN: Record<string, string> = {
  contactos: "creado_por",
  operadores: "created_by",
  activos: "creado_por",
  locales: "created_by",
  proyectos: "creado_por",
  negociaciones: "creado_por",
  matches: "generado_por",
  entity_narratives: "autor_id",
};

// Para upsert: cómo identificar un registro existente cuando no hay match.id
const UPSERT_KEYS: Record<string, string[]> = {
  operadores: ["nombre"],
  contactos: ["email"],
  activos: ["nombre", "ciudad"],
  locales: ["nombre", "codigo_postal"],
};

async function embedText(text: string, lovableKey: string): Promise<number[] | null> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/text-embedding-004",
        input: text.slice(0, 8000),
      }),
    });
    if (!r.ok) {
      console.warn("embedText failed:", r.status, await r.text().catch(() => ""));
      return null;
    }
    const d = await r.json();
    return d.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.warn("embedText error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    const canMutate = roles.includes("admin") || roles.includes("gestor");
    if (!canMutate) {
      return new Response(JSON.stringify({ error: "No tienes permiso para ejecutar acciones (rol gestor/admin requerido)" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { table, action, data, match } = body || {};

    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "Tabla no permitida: " + table }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["insert", "update", "upsert"].includes(action)) {
      return new Response(JSON.stringify({ error: "Acción no soportada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitizar data
    const cleanData: Record<string, any> = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (FORBIDDEN_FIELDS.includes(k)) continue;
      cleanData[k] = v;
    }

    // entity_narratives: embedding sync + autor_id
    if (table === "entity_narratives") {
      cleanData.autor_id = user.id;
      if (typeof cleanData.narrativa === "string" && cleanData.narrativa.trim().length > 0 && lovableKey) {
        const emb = await embedText(cleanData.narrativa, lovableKey);
        if (emb && Array.isArray(emb) && emb.length === 768) {
          cleanData.embedding = emb as unknown as string;
        }
      }
    }

    let result: any;
    let resolvedAction: "insert" | "update" = "insert";

    // UPSERT: buscar existente, decidir insert vs update
    if (action === "upsert") {
      const keys = UPSERT_KEYS[table];
      let existing: any = null;
      if (match && match.id) {
        const { data: row } = await admin.from(table).select("id").eq("id", match.id).maybeSingle();
        existing = row;
      } else if (keys && keys.every((k) => cleanData[k] !== undefined && cleanData[k] !== null && cleanData[k] !== "")) {
        let q = admin.from(table).select("id");
        for (const k of keys) {
          // case-insensitive para texto
          q = (q as any).ilike(k, String(cleanData[k]));
        }
        const { data: rows } = await q.limit(1);
        existing = rows && rows.length > 0 ? rows[0] : null;
      }
      resolvedAction = existing ? "update" : "insert";
      if (resolvedAction === "update") {
        const { data: upd, error } = await admin.from(table).update(cleanData).eq("id", existing.id).select();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = upd;
      } else {
        const creatorCol = CREATOR_COLUMN[table];
        if (creatorCol && cleanData[creatorCol] === undefined) cleanData[creatorCol] = user.id;
        const { data: ins, error } = await admin.from(table).insert(cleanData).select();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = ins;
      }
    } else if (action === "insert") {
      const creatorCol = CREATOR_COLUMN[table];
      if (creatorCol && cleanData[creatorCol] === undefined) cleanData[creatorCol] = user.id;
      const { data: ins, error } = await admin.from(table).insert(cleanData).select();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = ins;
      resolvedAction = "insert";
    } else {
      // update
      if (!match || !match.id) {
        return new Response(JSON.stringify({ error: "Update requiere match.id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let q = admin.from(table).update(cleanData);
      for (const [k, v] of Object.entries(match)) {
        q = q.eq(k, v as string);
      }
      const { data: upd, error } = await q.select();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = upd;
      resolvedAction = "update";
    }

    return new Response(JSON.stringify({ success: true, result, resolved_action: resolvedAction }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ava-execute-action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
