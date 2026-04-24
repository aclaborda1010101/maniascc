import type { PerfilIA } from "@/types/perfilIa";

/**
 * MOCK de referencia (contrato byte-a-byte con el generador).
 * - Cubre todos los campos del shape `PerfilIA`.
 * - `evolution.status` usa el enum del spec: 'mejorando' | 'estable' | 'deteriorando' | 'dormida'.
 * - Activable en dev añadiendo `?mock=1` a la URL de /contacto/:id.
 */
export const perfilIaMock: PerfilIA = {
  timeline: [
    { month: "2024-09", count: 3, sentiment: "neutral", label: "primer email" },
    { month: "2024-10", count: 5, sentiment: "good" },
    { month: "2024-11", count: 8, sentiment: "good" },
    { month: "2024-12", count: 4, sentiment: "neutral" },
    { month: "2025-01", count: 12, sentiment: "good", label: "negociación abierta" },
    { month: "2025-02", count: 9, sentiment: "good" },
    { month: "2025-03", count: 14, sentiment: "good" },
    { month: "2025-04", count: 11, sentiment: "good" },
  ],
  stats: {
    total_messages: 66,
    first_contact: "2024-09-12T10:14:00Z",
    last_contact: "2026-04-22T17:03:00Z",
    days_since_last: 2,
    initiated_by_us_pct: 38,
    trend_30d_pct: 24,
    channels: ["email", "whatsapp"],
    preferred_hours: [10, 11, 17],
    preferred_days: ["mar", "mié", "jue"],
  },
  key_events: [
    {
      date: "2024-09-12",
      tipo: "primer_contacto",
      description: "Primer email tras evento sectorial en IFEMA.",
      score: "neutral",
    },
    {
      date: "2024-11-04",
      tipo: "visita",
      description: "Visita conjunta al activo de Arganda. Feedback muy positivo.",
      score: "good",
    },
    {
      date: "2025-01-15",
      tipo: "propuesta",
      description: "Enviada propuesta económica preliminar (renta 18€/m²).",
      score: "good",
    },
    {
      date: "2025-03-02",
      tipo: "objecion",
      description: "Pidió rebaja del 10% en renta. Negociación viva.",
      score: "neutral",
    },
    {
      date: "2025-04-10",
      tipo: "avance",
      description: "Acordado heads of terms. Pendiente legal.",
      score: "good",
    },
  ],
  evolution: {
    status: "mejorando",
    summary:
      "Relación en tendencia ascendente. Frecuencia y profundidad de los intercambios crecen mes a mes; iniciativa cada vez más por su parte.",
    recent_evolution: [
      { when: "Últimos 30 días", desc: "+24% en mensajes vs mes anterior." },
      { when: "Últimos 7 días", desc: "Nos inicia la conversación en 3 de cada 5 hilos." },
      { when: "Hoy", desc: "Pidió fechas para cerrar visita técnica." },
    ],
  },
  datos_clave: [
    "Director de Expansión",
    "Toma decisiones en formato",
    "Prefiere reuniones cortas",
    "Sensible al timing de obras",
    "Ha trabajado antes con Aldi",
    "Valora la transparencia financiera",
  ],
  generated_at: "2026-04-22T18:00:00Z",
  perfil_profesional: {
    cargo_actual: "Director de Expansión",
    empresa_actual: "Aldi España",
    sector: "Retail alimentación",
    nivel_decision: "decisor",
    trayectoria: [
      "Lidl (2012–2018, Expansion Manager)",
      "Mercadona (2018–2021, Real Estate)",
      "Aldi (2021–actualidad, Director Expansión)",
    ],
    proyectos_mencionados: [
      "La Milla Arganda",
      "Parque Sur Móstoles",
      "Centro Henares",
    ],
    skills_detectadas: [
      "Análisis de ubicación",
      "Negociación de rentas",
      "Lectura de planimetrías",
      "Modelado financiero",
    ],
    estilo_comunicacion:
      "Formal y directo, prefiere datos concretos sobre narrativa. Responde en menos de 24h.",
    fortalezas: [
      "Conocimiento profundo del mercado retail",
      "Decisor real (no necesita comité)",
      "Capacidad de cierre rápida cuando los números cuadran",
    ],
    patrones_negociacion: [
      "Pide siempre rebaja del 8–12% en primera contraoferta",
      "Cierra los viernes por la tarde",
      "Usa silencio estratégico tras propuesta económica",
    ],
  },
  perfil_personal: {
    intereses: ["ciclismo", "vinos de Rioja", "F1", "running"],
    personalidad: ["directo", "analítico", "cercano", "competitivo"],
    relacion_con_fran:
      "Profesional histórica con tono cordial. Coincidieron en eventos sectoriales (IFEMA, MAPIC).",
    eventos_personales: [
      "Mencionó nacimiento de su segundo hijo en marzo 2025",
      "Operación de rodilla menor en otoño 2024",
    ],
    tono_emocional_promedio: "positivo",
  },
};
