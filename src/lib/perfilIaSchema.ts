/**
 * Schema Zod del contrato `PerfilIA`.
 *
 * Sirve como contrato ejecutable entre el generador (Fran/Gorka) y la UI.
 * Cualquier output que no pase `validatePerfilIA` no debe insertarse en
 * `contactos.perfil_ia` — la UI rompería al intentar renderizar shapes
 * inválidos (enums fuera de rango, fechas mal formadas, etc.).
 *
 * Espejo 1:1 de `src/types/perfilIa.ts`. Mantener ambos sincronizados.
 */
import { z } from "zod";
import type { PerfilIA } from "@/types/perfilIa";

/* ────────────────────────────────────────────────────────────────────────── */
/* Schemas atómicos                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export const SentimentSchema = z.enum(["good", "neutral", "bad"]);

export const EvolutionStatusSchema = z.enum([
  "mejorando",
  "estable",
  "deteriorando",
  "dormida",
]);

export const IsoMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be YYYY-MM");

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

/** ISO 8601 con offset (`...Z` o `±HH:MM`). */
export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "must be ISO 8601 with offset" });

export const PreferredDaySchema = z.enum([
  "lun",
  "mar",
  "mié",
  "jue",
  "vie",
  "sáb",
  "dom",
]);

const NonNegInt = z.number().int().nonnegative();
const Pct0to100 = z.number().int().min(0).max(100);
const Hour0to23 = z.number().int().min(0).max(23);

/* ────────────────────────────────────────────────────────────────────────── */
/* Schemas compuestos                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export const TimelinePointSchema = z.object({
  month: IsoMonthSchema,
  count: NonNegInt,
  sentiment: SentimentSchema,
  label: z.string().min(1).optional(),
});

export const PerfilStatsSchema = z.object({
  total_messages: NonNegInt,
  first_contact: IsoDateTimeSchema,
  last_contact: IsoDateTimeSchema,
  days_since_last: NonNegInt,
  initiated_by_us_pct: Pct0to100,
  /** % cambio últimos 30 días vs anteriores. Puede ser negativo. */
  trend_30d_pct: z.number().int(),
  channels: z.array(z.string().min(1)),
  preferred_hours: z.array(Hour0to23),
  preferred_days: z.array(PreferredDaySchema),
});

export const KeyEventSchema = z.object({
  date: IsoDateSchema,
  tipo: z.string().min(1),
  description: z.string().min(1),
  score: SentimentSchema,
});

export const EvolutionBlockSchema = z.object({
  status: EvolutionStatusSchema,
  summary: z.string(),
  recent_evolution: z.array(
    z.object({
      when: z.string().min(1),
      desc: z.string().min(1),
    })
  ),
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Bloques opcionales: perfil_profesional + perfil_personal                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const NivelDecisionSchema = z.enum([
  "decisor",
  "ejecutor",
  "influencer",
  "info",
]);

export const TonoEmocionalSchema = z.enum([
  "positivo",
  "neutral",
  "tenso",
  "variable",
]);

export const PerfilProfesionalSchema = z.object({
  cargo_actual: z.string(),
  empresa_actual: z.string(),
  sector: z.string(),
  nivel_decision: NivelDecisionSchema,
  trayectoria: z.array(z.string()),
  proyectos_mencionados: z.array(z.string()),
  skills_detectadas: z.array(z.string()),
  estilo_comunicacion: z.string(),
  fortalezas: z.array(z.string()),
  patrones_negociacion: z.array(z.string()),
});

export const PerfilPersonalSchema = z.object({
  intereses: z.array(z.string()),
  personalidad: z.array(z.string()),
  relacion_con_fran: z.string(),
  eventos_personales: z.array(z.string()),
  tono_emocional_promedio: TonoEmocionalSchema,
});

export const PerfilIaSchema = z.object({
  timeline: z.array(TimelinePointSchema),
  stats: PerfilStatsSchema,
  key_events: z.array(KeyEventSchema),
  evolution: EvolutionBlockSchema,
  datos_clave: z.array(z.string().min(1)),
  generated_at: IsoDateTimeSchema,
  perfil_profesional: PerfilProfesionalSchema.optional(),
  perfil_personal: PerfilPersonalSchema.optional(),
});

/* ────────────────────────────────────────────────────────────────────────── */
/* API pública                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export type ValidationResult =
  | { ok: true; data: PerfilIA }
  | { ok: false; error: string; issues: z.ZodIssue[] };

/**
 * Valida un objeto contra el contrato PerfilIA.
 *
 * Uso típico desde el generador:
 * ```ts
 * const r = validatePerfilIA(json);
 * if (!r.ok) { console.error("Perfil inválido:", r.error); return; }
 * await supabase.from("contactos").update({ perfil_ia: r.data }).eq("id", id);
 * ```
 */
export function validatePerfilIA(obj: unknown): ValidationResult {
  const result = PerfilIaSchema.safeParse(obj);
  if (result.success) {
    return { ok: true, data: result.data as PerfilIA };
  }
  const error = result.error.issues
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("; ");
  return { ok: false, error, issues: result.error.issues };
}
