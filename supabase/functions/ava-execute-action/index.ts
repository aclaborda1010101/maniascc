import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = ["contactos", "operadores", "activos", "locales", "proyectos", "negociaciones", "matches"];

// Campos prohibidos de sobreescribir desde el agente
const FORBIDDEN_FIELDS = ["id", "created_at", "updated_at"];

// Mapeo de columna "creado por" según tabla
const CREATOR_COLUMN: Record<string, string> = {
  contactos: "creado_por",
  operadores: "created_by",
  activos: "creado_por",
  locales: "created_by",
  proyectos: "creado_por",
  negociaciones: "creado_por",
  matches: "generado_por",
};

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

    // Verificar rol gestor o admin (RLS lo exige para mutaciones)
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    const canMutate = roles.includes("admin") || roles.includes("gestor");
    if (!canMutate) {
      return new Response(JSON.stringify({ error: "No tienes permiso para ejecutar acciones (rol gestor/admin requerido)" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { table, action, data, match } = body || {};

    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "Tabla no permitida: " + table }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["insert", "update"].includes(action)) {
      return new Response(JSON.stringify({ error: "Acción no soportada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitizar data
    const cleanData: Record<string, any> = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (FORBIDDEN_FIELDS.includes(k)) continue;
      cleanData[k] = v;
    }

    let result: any;
    if (action === "insert") {
      const creatorCol = CREATOR_COLUMN[table];
      if (creatorCol) cleanData[creatorCol] = user.id;
      const { data: ins, error } = await admin.from(table).insert(cleanData).select();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = ins;
    } else {
      if (!match || !match.id) {
        return new Response(JSON.stringify({ error: "Update requiere match.id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let q = admin.from(table).update(cleanData);
      for (const [k, v] of Object.entries(match)) {
        q = q.eq(k, v as string);
      }
      const { data: upd, error } = await q.select();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = upd;
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ava-execute-action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
