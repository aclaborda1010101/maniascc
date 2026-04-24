/**
 * Contrato del perfil_ia rico de un contacto/operador/activo.
 * Generado por el backend desde emails + actividad y guardado en
 * `contactos.perfil_ia` (jsonb). La UI lo renderiza tal cual.
 *
 * Mantener este shape sincronizado con el generador (Fran/Gorka).
 */

export type Sentiment = "good" | "neutral" | "bad";

export type EvolutionStatus =
  | "mejorando"
  | "estable"
  | "deteriorando"
  | "dormida";

export interface TimelinePoint {
  /** ISO month, ej "2025-03" */
  month: string;
  count: number;
  sentiment: Sentiment;
  /** etiqueta opcional sobre el punto, ej "primer email" */
  label?: string;
}

export interface PerfilStats {
  total_messages: number;
  /** ISO date */
  first_contact: string;
  /** ISO date */
  last_contact: string;
  days_since_last: number;
  /** 0–100 */
  initiated_by_us_pct: number;
  /** % cambio últimos 30 días vs anteriores */
  trend_30d_pct: number;
  channels: string[];
  /** horas (0–23) más frecuentes */
  preferred_hours: number[];
  /** ej ["lun", "mar"] */
  preferred_days: string[];
}

export interface KeyEvent {
  /** ISO date */
  date: string;
  tipo: string;
  description: string;
  score: Sentiment;
}

export interface EvolutionBlock {
  status: EvolutionStatus;
  summary: string;
  recent_evolution: { when: string; desc: string }[];
}

export interface PerfilIA {
  timeline: TimelinePoint[];
  stats: PerfilStats;
  key_events: KeyEvent[];
  evolution: EvolutionBlock;
  /** chips cortos con datos clave extraídos */
  datos_clave: string[];
  /** ISO timestamp de generación */
  generated_at: string;
}

/**
 * Parseo seguro desde jsonb. Devuelve null si el shape es inválido.
 */
export function parsePerfilIA(raw: unknown): PerfilIA | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Mínimos imprescindibles: que exista al menos uno de los bloques.
  const hasAny =
    Array.isArray(r.timeline) ||
    Array.isArray(r.key_events) ||
    Array.isArray(r.datos_clave) ||
    (r.stats && typeof r.stats === "object") ||
    (r.evolution && typeof r.evolution === "object");
  if (!hasAny) return null;

  return {
    timeline: Array.isArray(r.timeline) ? (r.timeline as TimelinePoint[]) : [],
    stats: (r.stats as PerfilStats) || ({} as PerfilStats),
    key_events: Array.isArray(r.key_events)
      ? (r.key_events as KeyEvent[])
      : [],
    evolution:
      (r.evolution as EvolutionBlock) ||
      ({ status: "estable", summary: "", recent_evolution: [] } as EvolutionBlock),
    datos_clave: Array.isArray(r.datos_clave)
      ? (r.datos_clave as string[])
      : [],
    generated_at:
      typeof r.generated_at === "string" ? (r.generated_at as string) : "",
  };
}

/**
 * True si el perfil está prácticamente vacío y conviene
 * mostrar un placeholder de "perfil pendiente de generación".
 * El generador puede usar la misma heurística para decidir
 * qué contactos regenerar.
 */
export function isPerfilEmpty(p: PerfilIA | null): boolean {
  if (!p) return true;
  const noTimeline = !p.timeline || p.timeline.length === 0;
  const noEvents = !p.key_events || p.key_events.length === 0;
  const noStats = !p.stats || !p.stats.total_messages;
  const noChips = !p.datos_clave || p.datos_clave.length === 0;
  return noTimeline && noEvents && noStats && noChips;
}
