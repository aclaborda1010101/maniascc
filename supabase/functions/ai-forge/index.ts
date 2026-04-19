import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ForgeMode = "dossier_operador" | "presentacion_comercial" | "borrador_contrato" | "plan_estrategico" | "informe_war_room" | "email_comunicacion";

// ═══════════════════════════════════════════════════════════════════════════
// PROMPTS DE NIVEL CONSULTORÍA — UNO POR MODO
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_BASE = `Eres FORGE, el motor de generación documental de F&G Real Estate, una consultora inmobiliaria especializada en retail, centros comerciales y high-street.

Tu salida debe ser equivalente a un documento producido por un manager senior de McKinsey, BCG o Cushman & Wakefield: denso en datos, estructurado, con jerarquía visual clara y conclusiones accionables.

REGLAS GLOBALES:
1. Idioma: español de España, registro profesional formal.
2. Cero relleno: cada frase aporta información nueva. Prohibido "es importante señalar", "cabe destacar", "en conclusión".
3. Datos antes que opinión. Cuando inventes cifras (porque no las tengas en el contexto), usa rangos plausibles del mercado retail español 2024-2025 y márcalas implícitamente con lenguaje "estimado" / "rango".
4. Tono ejecutivo: directo, asertivo, basado en evidencia.
5. NO uses emojis. NO uses primera persona. NO uses preguntas retóricas.
6. Cuando el contexto del proyecto incluya documentos RAG, cítalos por su nombre entre [corchetes] al final del párrafo correspondiente.

DEBES devolver tu respuesta INVOCANDO la herramienta correspondiente al modo solicitado, con todos los campos requeridos rellenos. NO devuelvas markdown ni texto libre fuera del tool call.`;

const MODE_INSTRUCTIONS: Record<ForgeMode, string> = {
  dossier_operador: `Genera un DOSSIER DE OPERADOR de nivel consultoría inmobiliaria.

ESTRUCTURA OBLIGATORIA (rellena todos los campos del schema "build_dossier_operador"):

1. **cover.title**: nombre del operador en mayúsculas. Ej: "GRUPO VIPS · DOSSIER ESTRATÉGICO".
2. **cover.subtitle**: una línea de posicionamiento. Ej: "Análisis de viabilidad para implantación en C.C. La Milla Arganda".
3. **cover.tagline**: lema o descripción del sector en una línea.

4. **executive_summary**: 3-5 párrafos densos que cubran: (a) quién es el operador, (b) por qué encaja con el activo, (c) condiciones tipo que aceptaría, (d) riesgos clave, (e) recomendación final con verbo accionable ("Iniciar contacto comercial vía...", "Descartar por...", "Esperar a Q2 2026 porque...").

5. **kpis**: exactamente 4 KPIs con label corto (≤20 char), value (string corto, p.ej. "850", "12,5%", "€280k"), unit opcional, y caption (1 línea contextual). Ejemplos: "Tiendas activas / 850 / España", "Facturación media / €280k / por tienda/año", "Renta dispuesta / €18-24 / €/m²/mes", "Tiempo cierre / 4-6 / meses".

6. **profile**: perfil corporativo en formato definition list. items[] con term/definition. Mínimo 6 items: Razón social, Sector, Año fundación, Sede central, Modelo de negocio, Presencia geográfica, Tamaño tienda tipo, Inversión CapEx tipo, Esquema renta preferido, Referencias bancarias.

7. **history_table**: tabla de operaciones / negociaciones recientes conocidas o plausibles. headers: ["Operación", "Centro", "Año", "m²", "Renta €/m²", "Estado"]. 5-8 filas.

8. **negotiation_levers**: array de 4-6 callouts tipo "lever". Cada uno con title (palanca) y body (cómo usarla). Ej: "Periodo de carencia ampliado · Suelen aceptar hasta 9 meses si la renta lineal supera €22/m²".

9. **risks**: array de 3-5 risks con title y body. Marcar severity ("low"|"medium"|"high"). Ej: "Concentración geográfica · Dependencia >40% del Corredor del Henares...".

10. **recommendations**: 3-5 recomendaciones accionables con priority ("alta"|"media"|"baja"), action y rationale.

11. **appendix.sources**: 3-6 fuentes citadas (memorias anuales, prensa sectorial, RAG docs).

Tono: analítico, frío, basado en datos. Cero adjetivos vacíos.`,

  presentacion_comercial: `Genera el contenido de una PRESENTACIÓN COMERCIAL premium tipo "investment teaser" de un activo retail.

ESTRUCTURA (schema "build_presentacion_comercial"):

1. **cover.title**: nombre del activo en formato impacto. Ej: "C.C. LA MILLA ARGANDA".
2. **cover.subtitle**: tagline comercial. Ej: "Parque de conveniencia · 14.500 m² · Corredor Henares".
3. **cover.hero_prompt**: descripción visual en inglés para generar imagen de portada con IA. Ej: "Aerial photograph of a modern Spanish retail park at golden hour, glass facades, palm trees, parking lot full, blue sky, professional real estate photography style".

4. **executive_summary**: 3-4 párrafos. Posicionamiento + propuesta de valor + estado comercialización + por qué invertir/abrir aquí ahora.

5. **kpis**: 4 KPIs hero (SBA, GLA disponible, ratio aforo, renta media). Mismo formato que dossier.

6. **market_section.title** + **market_section.body**: 2-3 párrafos sobre demanda en isócrona 15min, renta familiar disponible, gap competitivo.

7. **tenant_mix**: array de items con sector, share_pct (número 0-100), brands (string con marcas tipo). 5-7 sectores. Suma debería rondar 100.

8. **financial_projection**: tabla. headers: ["Año", "Ocupación %", "Renta media €/m²", "NOI estimado €", "Yield"]. 5 filas (Y1 a Y5).

9. **highlights**: 4-6 callouts con icon (string corto, p.ej. "tráfico", "demanda", "accesibilidad"), title, body.

10. **next_steps**: 3-5 pasos numerados con title y body.

11. **contact_block**: name, role, phone, email del responsable comercial (usa "Comercialización F&G Real Estate · comercial@fgrealestate.com · +34 91 000 00 00" si no hay datos).

Tono: persuasivo profesional, premium, evita superlativos vacíos.`,

  borrador_contrato: `Genera un BORRADOR DE CONTRATO DE ARRENDAMIENTO PARA USO DISTINTO DE VIVIENDA con cláusulas estructuradas.

ESTRUCTURA (schema "build_borrador_contrato"):

1. **cover.title**: "CONTRATO DE ARRENDAMIENTO · USO DISTINTO DE VIVIENDA".
2. **cover.subtitle**: "Borrador no vinculante · Sujeto a revisión jurídica".

3. **partes**: objeto con arrendador (nombre, NIF/CIF, domicilio, representante) y arrendatario (mismos campos). Si el contexto no aporta, usa "[A completar]" como placeholder.

4. **expone**: 3-5 párrafos de "EXPONEN" enumerados (I, II, III...).

5. **clausulas**: array de 12-18 cláusulas. Cada una con:
   - numero (romano: "PRIMERA", "SEGUNDA"...)
   - titulo (ej: "OBJETO DEL CONTRATO")
   - apartados: array de objetos con letra ("a)", "b)") y texto (1-3 frases formales jurídicas).

   Cláusulas obligatorias en este orden: OBJETO, DESTINO Y USO, DURACIÓN Y PRÓRROGAS, RENTA Y FORMA DE PAGO, ACTUALIZACIÓN DE RENTA, FIANZA Y GARANTÍAS ADICIONALES, GASTOS Y SUMINISTROS, OBRAS Y CONSERVACIÓN, CESIÓN Y SUBARRIENDO, SUBROGACIÓN, RESOLUCIÓN, INCUMPLIMIENTO Y PENALIZACIONES, NOTIFICACIONES, PROTECCIÓN DE DATOS, FUERO Y JURISDICCIÓN, PACTOS PARTICULARES.

6. **anexos**: array de 3-5 anexos referenciados (Plano del local, Inventario, Memoria de calidades, Tabla de rentas, etc.) con titulo y descripcion.

7. **footer_disclaimer**: "El presente documento constituye un BORRADOR ORIENTATIVO. No tiene carácter vinculante hasta su revisión por asesoría jurídica y firma de las partes."

Tono: jurídico formal, neutro, sin adjetivos. Tercera persona.`,

  plan_estrategico: `Genera un PLAN ESTRATÉGICO DE COMERCIALIZACIÓN Y POSICIONAMIENTO de un activo o cartera retail, estilo informe McKinsey.

ESTRUCTURA (schema "build_plan_estrategico"):

1. **cover.title**: "PLAN ESTRATÉGICO 2026-2027" + nombre activo.
2. **cover.subtitle**: ámbito y horizonte.

3. **executive_summary**: 4-5 párrafos. Diagnóstico + ambición + 3-5 iniciativas clave + impacto esperado cuantificado + ask al comité.

4. **diagnostico_kpis**: 4 KPIs del estado actual.

5. **dafo**: objeto con 4 arrays de 3-5 bullets cada uno: fortalezas, debilidades, oportunidades, amenazas. Cada bullet 1 línea concreta.

6. **objetivos**: array de 3-5 objetivos SMART. Cada uno: titulo, kpi_objetivo (ej: "Ocupación ≥92% a 24 meses"), descripcion.

7. **iniciativas**: array de 5-8 iniciativas. Cada una: nombre, descripcion (2-3 líneas), responsable (rol), horizonte ("0-6m" | "6-12m" | "12-24m"), impacto_estimado (texto), inversion_estimada (texto, p.ej. "€80-120k").

8. **roadmap**: array de hitos cronológicos. Cada uno: trimestre (ej: "Q1 2026"), hito, dependencias (string opcional).

9. **proyeccion_financiera**: tabla. headers: ["Año", "Ingresos rentas €", "Gastos opex €", "NOI €", "Yield %", "Valor activo €"]. 5 filas.

10. **riesgos**: array 3-5 con title, body, severity, mitigation.

11. **recomendacion_comite**: 1 párrafo cerrado con verbo decisional ("Aprobar", "Aprobar condicionado a...", "Posponer hasta...").`,

  informe_war_room: `Genera un INFORME WAR ROOM ejecutivo: dashboard impreso para comité semanal.

ESTRUCTURA (schema "build_informe_war_room"):

1. **cover.title**: "WAR ROOM · INFORME SEMANAL".
2. **cover.subtitle**: semana / fecha de corte.

3. **resumen_ejecutivo**: 2-3 párrafos densos. Estado global + 1 logro de la semana + 1 alerta crítica + decisión solicitada al comité.

4. **kpis_principales**: 4 KPIs operativos (operaciones activas, m² comprometidos, renta firmada YTD, pipeline ponderado).

5. **semaforos**: array de 5-8 indicadores con nombre, estado ("verde" | "ambar" | "rojo"), comentario corto (1 frase).

6. **operaciones_activas**: tabla. headers: ["Operador", "Activo", "m²", "Estado", "Probabilidad", "Cierre estimado"]. 6-12 filas.

7. **alertas**: array de 3-6 alertas. Cada una: severity ("info"|"warning"|"critical"), title, body, owner, due_date.

8. **oportunidades**: 3-5 callouts con title, body.

9. **decisiones_pendientes**: array. Cada una: tema, opciones (array de 2-3 strings), recomendacion, deadline.

10. **proximas_acciones**: 5-8 acciones con accion, owner, fecha.

Tono: telegráfico, directo, accionable. Cada palabra cuenta.`,

  email_comunicacion: `Genera un EMAIL PROFESIONAL adaptado al destinatario y contexto.

ESTRUCTURA (schema "build_email_comunicacion"):

1. **subject**: asunto preciso, 6-12 palabras, sin clickbait.
2. **preheader**: una línea preview (≤90 caracteres).
3. **greeting**: "Estimado/a [Nombre]," o "Buenos días [Nombre],".
4. **body_paragraphs**: array de 3-5 párrafos. Primer párrafo: motivo del email en 1-2 frases. Cuerpo: información o propuesta. Penúltimo: llamada a la acción específica con fecha. Último: cierre.
5. **signature**: objeto con name, role, company, phone, email.
6. **plain_text_version**: la misma versión en texto plano, sin HTML, líneas máx 78 char.
7. **tone**: ("cordial" | "formal" | "directo" | "negociador") según el contexto.

Tono general: profesional cálido, sin coloquialismos, sin "espero que te encuentres bien".`,
};

// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — uno por modo
// ═══════════════════════════════════════════════════════════════════════════

const COVER_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    tagline: { type: "string" },
    hero_prompt: { type: "string" },
  },
  required: ["title", "subtitle"],
};

// Mirmidons-friendly optional blocks (the model can fill them when relevant — graceful fallback if absent).
const ASSET_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" }, city: { type: "string" }, province: { type: "string" },
    typology: { type: "string" }, gla: { type: "string" }, year_built: { type: "string" },
  },
};
const OPERATOR_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" }, brand: { type: "string" }, category: { type: "string" }, sector: { type: "string" },
  },
};

const KPI_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string" },
    value: { type: "string" },
    unit: { type: "string" },
    caption: { type: "string" },
  },
  required: ["label", "value", "caption"],
};

const TABLE_SCHEMA = {
  type: "object",
  properties: {
    headers: { type: "array", items: { type: "string" } },
    rows: { type: "array", items: { type: "array", items: { type: "string" } } },
    caption: { type: "string" },
  },
  required: ["headers", "rows"],
};

const CALLOUT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    severity: { type: "string", enum: ["info", "low", "medium", "high", "warning", "critical"] },
    icon: { type: "string" },
  },
  required: ["title", "body"],
};

const TOOLS: Record<ForgeMode, any> = {
  dossier_operador: {
    type: "function",
    function: {
      name: "build_dossier_operador",
      description: "Construye un dossier estructurado de operador retail.",
      parameters: {
        type: "object",
        properties: {
          cover: COVER_SCHEMA,
          executive_summary: { type: "string", description: "3-5 párrafos densos separados por \\n\\n" },
          kpis: { type: "array", items: KPI_SCHEMA, minItems: 4, maxItems: 4 },
          profile: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: { term: { type: "string" }, definition: { type: "string" } },
                  required: ["term", "definition"],
                },
              },
            },
            required: ["items"],
          },
          history_table: TABLE_SCHEMA,
          negotiation_levers: { type: "array", items: CALLOUT_SCHEMA },
          risks: { type: "array", items: CALLOUT_SCHEMA },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                priority: { type: "string", enum: ["alta", "media", "baja"] },
                action: { type: "string" },
                rationale: { type: "string" },
              },
              required: ["priority", "action", "rationale"],
            },
          },
          appendix: {
            type: "object",
            properties: { sources: { type: "array", items: { type: "string" } } },
            required: ["sources"],
          },
        },
        required: ["cover", "executive_summary", "kpis", "profile", "history_table", "negotiation_levers", "risks", "recommendations", "appendix"],
      },
    },
  },
  presentacion_comercial: {
    type: "function",
    function: {
      name: "build_presentacion_comercial",
      description: "Construye una presentación comercial premium.",
      parameters: {
        type: "object",
        properties: {
          cover: {
            type: "object",
            properties: {
              title: { type: "string" },
              subtitle: { type: "string" },
              hero_prompt: { type: "string", description: "Prompt en inglés para generar imagen hero" },
            },
            required: ["title", "subtitle", "hero_prompt"],
          },
          executive_summary: { type: "string" },
          kpis: { type: "array", items: KPI_SCHEMA, minItems: 4, maxItems: 4 },
          market_section: {
            type: "object",
            properties: { title: { type: "string" }, body: { type: "string" } },
            required: ["title", "body"],
          },
          tenant_mix: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sector: { type: "string" },
                share_pct: { type: "number" },
                brands: { type: "string" },
              },
              required: ["sector", "share_pct", "brands"],
            },
          },
          financial_projection: TABLE_SCHEMA,
          highlights: { type: "array", items: CALLOUT_SCHEMA },
          next_steps: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" }, body: { type: "string" } },
              required: ["title", "body"],
            },
          },
          contact_block: {
            type: "object",
            properties: {
              name: { type: "string" }, role: { type: "string" },
              phone: { type: "string" }, email: { type: "string" },
            },
            required: ["name", "role", "phone", "email"],
          },
        },
        required: ["cover", "executive_summary", "kpis", "market_section", "tenant_mix", "financial_projection", "highlights", "next_steps", "contact_block"],
      },
    },
  },
  borrador_contrato: {
    type: "function",
    function: {
      name: "build_borrador_contrato",
      description: "Construye un borrador de contrato de arrendamiento estructurado.",
      parameters: {
        type: "object",
        properties: {
          cover: COVER_SCHEMA,
          partes: {
            type: "object",
            properties: {
              arrendador: {
                type: "object",
                properties: {
                  nombre: { type: "string" }, nif: { type: "string" },
                  domicilio: { type: "string" }, representante: { type: "string" },
                },
                required: ["nombre", "nif", "domicilio"],
              },
              arrendatario: {
                type: "object",
                properties: {
                  nombre: { type: "string" }, nif: { type: "string" },
                  domicilio: { type: "string" }, representante: { type: "string" },
                },
                required: ["nombre", "nif", "domicilio"],
              },
            },
            required: ["arrendador", "arrendatario"],
          },
          expone: { type: "array", items: { type: "string" } },
          clausulas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                numero: { type: "string" },
                titulo: { type: "string" },
                apartados: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { letra: { type: "string" }, texto: { type: "string" } },
                    required: ["letra", "texto"],
                  },
                },
              },
              required: ["numero", "titulo", "apartados"],
            },
          },
          anexos: {
            type: "array",
            items: {
              type: "object",
              properties: { titulo: { type: "string" }, descripcion: { type: "string" } },
              required: ["titulo", "descripcion"],
            },
          },
          footer_disclaimer: { type: "string" },
        },
        required: ["cover", "partes", "expone", "clausulas", "anexos", "footer_disclaimer"],
      },
    },
  },
  plan_estrategico: {
    type: "function",
    function: {
      name: "build_plan_estrategico",
      description: "Construye un plan estratégico de comercialización.",
      parameters: {
        type: "object",
        properties: {
          cover: COVER_SCHEMA,
          executive_summary: { type: "string" },
          diagnostico_kpis: { type: "array", items: KPI_SCHEMA, minItems: 4, maxItems: 4 },
          dafo: {
            type: "object",
            properties: {
              fortalezas: { type: "array", items: { type: "string" } },
              debilidades: { type: "array", items: { type: "string" } },
              oportunidades: { type: "array", items: { type: "string" } },
              amenazas: { type: "array", items: { type: "string" } },
            },
            required: ["fortalezas", "debilidades", "oportunidades", "amenazas"],
          },
          objetivos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string" }, kpi_objetivo: { type: "string" }, descripcion: { type: "string" },
              },
              required: ["titulo", "kpi_objetivo", "descripcion"],
            },
          },
          iniciativas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nombre: { type: "string" }, descripcion: { type: "string" },
                responsable: { type: "string" },
                horizonte: { type: "string", enum: ["0-6m", "6-12m", "12-24m"] },
                impacto_estimado: { type: "string" }, inversion_estimada: { type: "string" },
              },
              required: ["nombre", "descripcion", "responsable", "horizonte", "impacto_estimado", "inversion_estimada"],
            },
          },
          roadmap: {
            type: "array",
            items: {
              type: "object",
              properties: {
                trimestre: { type: "string" }, hito: { type: "string" }, dependencias: { type: "string" },
              },
              required: ["trimestre", "hito"],
            },
          },
          proyeccion_financiera: TABLE_SCHEMA,
          riesgos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" }, body: { type: "string" },
                severity: { type: "string", enum: ["low", "medium", "high"] },
                mitigation: { type: "string" },
              },
              required: ["title", "body", "severity", "mitigation"],
            },
          },
          recomendacion_comite: { type: "string" },
        },
        required: ["cover", "executive_summary", "diagnostico_kpis", "dafo", "objetivos", "iniciativas", "roadmap", "proyeccion_financiera", "riesgos", "recomendacion_comite"],
      },
    },
  },
  informe_war_room: {
    type: "function",
    function: {
      name: "build_informe_war_room",
      description: "Construye un informe war room ejecutivo.",
      parameters: {
        type: "object",
        properties: {
          cover: COVER_SCHEMA,
          resumen_ejecutivo: { type: "string" },
          kpis_principales: { type: "array", items: KPI_SCHEMA, minItems: 4, maxItems: 4 },
          semaforos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nombre: { type: "string" },
                estado: { type: "string", enum: ["verde", "ambar", "rojo"] },
                comentario: { type: "string" },
              },
              required: ["nombre", "estado", "comentario"],
            },
          },
          operaciones_activas: TABLE_SCHEMA,
          alertas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                severity: { type: "string", enum: ["info", "warning", "critical"] },
                title: { type: "string" }, body: { type: "string" },
                owner: { type: "string" }, due_date: { type: "string" },
              },
              required: ["severity", "title", "body", "owner", "due_date"],
            },
          },
          oportunidades: { type: "array", items: CALLOUT_SCHEMA },
          decisiones_pendientes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tema: { type: "string" },
                opciones: { type: "array", items: { type: "string" } },
                recomendacion: { type: "string" },
                deadline: { type: "string" },
              },
              required: ["tema", "opciones", "recomendacion", "deadline"],
            },
          },
          proximas_acciones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                accion: { type: "string" }, owner: { type: "string" }, fecha: { type: "string" },
              },
              required: ["accion", "owner", "fecha"],
            },
          },
        },
        required: ["cover", "resumen_ejecutivo", "kpis_principales", "semaforos", "operaciones_activas", "alertas", "oportunidades", "decisiones_pendientes", "proximas_acciones"],
      },
    },
  },
  email_comunicacion: {
    type: "function",
    function: {
      name: "build_email_comunicacion",
      description: "Construye un email profesional estructurado.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string" },
          preheader: { type: "string" },
          greeting: { type: "string" },
          body_paragraphs: { type: "array", items: { type: "string" } },
          signature: {
            type: "object",
            properties: {
              name: { type: "string" }, role: { type: "string" }, company: { type: "string" },
              phone: { type: "string" }, email: { type: "string" },
            },
            required: ["name", "role", "company", "phone", "email"],
          },
          plain_text_version: { type: "string" },
          tone: { type: "string", enum: ["cordial", "formal", "directo", "negociador"] },
          emailVariant: { type: "string", enum: ["teaser", "negociacion", "cierre"], description: "Variante visual de la plantilla email" },
          refCode: { type: "string", description: "Código de referencia interno opcional, p.ej. AP-2026-014" },
        },
        required: ["subject", "preheader", "greeting", "body_paragraphs", "signature", "plain_text_version", "tone"],
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claims.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { mode, context, proyecto_id, format, email_variant } = await req.json() as {
      mode: ForgeMode;
      context: string;
      proyecto_id?: string;
      format?: "structured" | "markdown";
      email_variant?: "teaser" | "negociacion" | "cierre";
    };

    if (!mode || !MODE_INSTRUCTIONS[mode]) {
      return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: corsHeaders });
    }
    if (!context) {
      return new Response(JSON.stringify({ error: "context required" }), { status: 400, headers: corsHeaders });
    }

    const wantStructured = format !== "markdown";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // RAG enrichment
    let ragContext = "";
    if (proyecto_id) {
      const domainMap: Record<ForgeMode, string[]> = {
        dossier_operador: ["operadores", "contratos"],
        presentacion_comercial: ["activos", "mercado"],
        borrador_contrato: ["contratos", "activos"],
        plan_estrategico: ["activos", "mercado", "operadores"],
        informe_war_room: ["general", "activos", "operadores"],
        email_comunicacion: ["personas", "operadores"],
      };
      const { data: chunks } = await admin
        .from("document_chunks")
        .select("contenido, dominio, metadata")
        .eq("proyecto_id", proyecto_id)
        .in("dominio", domainMap[mode] || ["general"])
        .limit(10);

      if (chunks && chunks.length > 0) {
        ragContext = "\n\n═══ CONTEXTO DOCUMENTAL DEL PROYECTO ═══\n" +
          chunks.map((c: any) => `[${c.metadata?.nombre || c.dominio}]\n${c.contenido}`).join("\n---\n");
      }
    }

    let modeExtra = "";
    if (mode === "email_comunicacion" && email_variant) {
      const variantBrief: Record<string, string> = {
        teaser: "VARIANTE: TEASER de aproximación inicial. Tono cordial-formal, presentar oportunidad, sin presión, CTA = solicitar reunión exploratoria. emailVariant='teaser'.",
        negociacion: "VARIANTE: NEGOCIACIÓN en curso. Tono directo-negociador, referencia oferta previa, condiciones concretas, CTA = respuesta con fecha. emailVariant='negociacion'.",
        cierre: "VARIANTE: CIERRE / FORMALIZACIÓN. Tono formal jurídico, confirmar acuerdo, próximos hitos firma, adjuntos previstos. emailVariant='cierre'.",
      };
      modeExtra = `\n\n═══ SUB-VARIANTE EMAIL ═══\n${variantBrief[email_variant]}\nIncluye además 'refCode' (formato 'AP-YYYY-NNN', 'NG-YYYY-NNN' o 'CL-YYYY-NNN' según corresponda).`;
    }
    const systemPrompt = `${SYSTEM_BASE}\n\n═══ INSTRUCCIONES DEL MODO "${mode}" ═══\n${MODE_INSTRUCTIONS[mode]}${modeExtra}`;
    const userMessage = `CONTEXTO / INSTRUCCIONES DEL USUARIO:\n${context}${ragContext}`;

    // Orden de modelos: el más fiable con tool calling complejo primero.
    const tryModels = ["google/gemini-2.5-pro", "google/gemini-3.1-pro-preview", "google/gemini-2.5-flash", "google/gemini-3-flash-preview"];

    // Helper: intenta parsear arguments del tool_call con saneo defensivo.
    const tryParseStructured = (msg: any): any | null => {
      const toolCall = msg?.tool_calls?.[0];
      const args = toolCall?.function?.arguments;
      if (args) {
        if (typeof args === "object") return args;
        if (typeof args === "string") {
          try { return JSON.parse(args); } catch (_) {
            // Saneo: a veces el modelo añade ```json ... ```
            const cleaned = args.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            try { return JSON.parse(cleaned); } catch (_e) { /* sigue */ }
          }
        }
      }
      // fallback: contenido de texto con JSON
      const txt = msg?.content;
      if (typeof txt === "string" && txt.trim()) {
        const cleaned = txt.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const start = cleaned.search(/[\{\[]/);
        const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
        if (start !== -1 && end > start) {
          try { return JSON.parse(cleaned.substring(start, end + 1)); } catch (_) { /* nada */ }
        }
      }
      return null;
    };

    let aiData: any = null;
    let modelUsed = "";
    let structured: any = null;
    let markdownContent = "";
    const startMs = Date.now();
    let lastErr = "";

    for (const model of tryModels) {
      const body: any = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      };
      if (wantStructured) {
        body.tools = [TOOLS[mode]];
        body.tool_choice = { type: "function", function: { name: TOOLS[mode].function.name } };
      }

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido. Inténtalo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!aiResp.ok) {
        lastErr = await aiResp.text();
        console.error(`FORGE model ${model} HTTP ${aiResp.status}:`, lastErr.slice(0, 500));
        continue;
      }

      const data = await aiResp.json();
      const message = data.choices?.[0]?.message;

      if (wantStructured) {
        const parsed = tryParseStructured(message);
        if (parsed) {
          aiData = data;
          structured = parsed;
          modelUsed = model;
          break;
        }
        // No vino structured: log y prueba el siguiente modelo.
        console.error(`FORGE model ${model} returned no structured output. Message preview:`, JSON.stringify(message).slice(0, 400));
        lastErr = `Modelo ${model} no devolvió tool_call válido`;
        continue;
      } else {
        aiData = data;
        markdownContent = message?.content || "";
        modelUsed = model;
        break;
      }
    }

    const latency = Date.now() - startMs;

    if (!aiData) {
      return new Response(JSON.stringify({
        error: `No se pudo generar el documento. Todos los modelos fallaron. ${lastErr ? `Detalle: ${lastErr}` : ""}`.trim(),
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (wantStructured && !structured) {
      return new Response(JSON.stringify({
        error: "El modelo no devolvió la estructura esperada después de varios intentos. Prueba a simplificar el contexto o vuelve a intentarlo.",
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("auditoria_ia").insert({
      funcion_ia: `forge:${mode}`,
      modelo: modelUsed,
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      latencia_ms: latency,
      exito: true,
      created_by: claims.user.id,
    });

    return new Response(JSON.stringify({
      content: markdownContent,
      structured,
      mode,
      model: modelUsed,
      latency_ms: latency,
      tokens: {
        input: aiData.usage?.prompt_tokens || 0,
        output: aiData.usage?.completion_tokens || 0,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("forge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
