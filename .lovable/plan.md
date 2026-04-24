# Perfil IA rico para contactos + extensión sistema narrativas (v2)

Implementación completa de la "Línea de Vida" estilo visionOS para `/contacto/:id`, junto con las extensiones del sistema de narrativas y la integración AVA conversacional con prompts pre-cargados.

**Cambios respecto al plan anterior** (correcciones que pediste):
- `evolution.status` usa el enum del spec: `'mejorando'|'estable'|'deteriorando'|'dormida'`.
- `EntityNarrativesPanel` soporta los 7 tipos reales del CHECK constraint: `historia, experiencia_buena, experiencia_mala, negociacion, nota, relacion_personal, contexto`. No se introducen `insight` ni `decision` para mantener coherencia constraint ↔ panel ↔ tools.

## Lo que vas a tener al terminar

1. **Página `/contacto/:id` rediseñada** con grid visionOS de 6 componentes que leen `contactos.perfil_ia` (jsonb existente).
2. **Sistema de narrativas extendido** con tags, visibilidad pública/privada y los 7 tipos del CHECK actual.
3. **AVA con prompts pre-cargados** desde botón "+ Añadir nota" en el detalle del contacto.
4. **Mock `perfil_ia`** para QA visual que servirá de contrato byte-a-byte para tu generador.

## Build order

### 1. Tipos `PerfilIA` (`src/types/perfilIa.ts`)
- Interface `PerfilIA` con sub-tipos `TimelinePoint`, `PerfilStats`, `KeyEvent`, `EvolutionBlock`.
- `evolution.status: 'mejorando'|'estable'|'deteriorando'|'dormida'`.
- Helper `parsePerfilIA(jsonb)` para parseo seguro desde Supabase.
- Helper `isPerfilEmpty(perfil)` para conditional rendering y para que tú lo reutilices identificando contactos a regenerar.

### 2. Componentes UI (`src/components/contacto/`)
- `PerfilIaSection.tsx` — wrapper con chip discreto "Generado hace X días" leyendo `generated_at`.
- `LineaDeVida.tsx` — Recharts LineChart. Si `timeline.length < 3` se oculta y se muestra fallback con stats/evolución.
- `EvolucionReciente.tsx` — badge de status (mejorando/estable/deteriorando/dormida) + summary + lista de cambios recientes.
- `DatosClaveChips.tsx` — hasta 6 chips con datos extraídos.
- `MetricasComunicacion.tsx` — grid de stats (mensajes, días sin contacto, % iniciado por nosotros, tendencia 30d, canales, horas/días preferidos).
- `LineaDelTiempo.tsx` — feed cronológico de eventos con iconos coloreados por sentiment.

### 3. Rewrite `src/pages/ContactoDetail.tsx`
- Layout visionOS grid (header con avatar + datos básicos, luego los 6 componentes).
- Usa `parsePerfilIA` y maneja caso `isPerfilEmpty` con placeholder elegante ("Perfil pendiente de generación").
- Botón "+ Añadir nota" → navega a `/asistente?prompt=...` con prompt pre-rellenado mencionando el contacto.
- Mantiene `EntityNarrativesPanel` debajo del perfil IA.

### 4. Extensión `EntityNarrativesPanel`
- Soporte para los **7 tipos del CHECK actual**: `historia`, `experiencia_buena`, `experiencia_mala`, `negociacion`, `nota`, `relacion_personal`, `contexto`. Cada uno con su entry en `TIPO_META` (icono + color + label).
- Selector de visibilidad: 🌐 compartida / 🔒 privada (default privada para `relacion_personal`).
- Input de tags (chips, con sugerencias básicas extraídas de tags existentes).
- Filtros por tipo y por visibilidad en la cabecera.

### 5. Extensión Edge Functions
- `ava-orchestrator`: schema de la tool `add_narrative` con `tipo` enum restringido a los **7 tipos válidos** del CHECK, más `tags: string[]` y `visibility: 'shared'|'private'`.
- `ava-execute-action`: pasar `tags` y `visibility` al insert en `entity_narratives`. Validar `tipo` contra el mismo enum antes de llamar al insert para evitar errores 23514.

### 6. AVA con prompts pre-cargados
- `AsistenteIA.tsx`: leer `searchParams.get('prompt')` al montar y, si existe, pre-rellenar el composer (sin auto-enviar — el usuario edita y manda).

### 7. Mock + QA visual
- Crear `src/mocks/perfilIaMock.ts` con un ejemplo realista que cubra todos los campos y use `evolution.status: 'mejorando'`.
- Inyectar el mock condicionalmente en dev (query param `?mock=1`) para QA visual.
- Pasarte el contenido completo del mock como contrato definitivo del shape.

## Detalles técnicos

**Tipo `PerfilIA`** (contrato byte-a-byte con tu generador):
```ts
type PerfilIA = {
  timeline: { month: string; count: number; sentiment: 'good'|'neutral'|'bad'; label?: string }[];
  stats: {
    total_messages: number;
    first_contact: string; last_contact: string; days_since_last: number;
    initiated_by_us_pct: number; trend_30d_pct: number;
    channels: string[]; preferred_hours: number[]; preferred_days: string[];
  };
  key_events: { date: string; tipo: string; description: string; score: 'good'|'neutral'|'bad' }[];
  evolution: {
    status: 'mejorando'|'estable'|'deteriorando'|'dormida';
    summary: string;
    recent_evolution: { when: string; desc: string }[];
  };
  datos_clave: string[];
  generated_at: string;
};
```

**Tipos de narrativa permitidos** (alineados con `entity_narratives_tipo_check`):
```
historia | experiencia_buena | experiencia_mala | negociacion | nota | relacion_personal | contexto
```

**Replicación**: la misma arquitectura (`PerfilIaSection` + 6 componentes) se reutilizará tal cual en `/operador/:id` y `/activo/:id` cuando el contacto funcione, cambiando solo la fuente del jsonb. Fuera de scope de este sprint.

**Decisiones que dejaré a mi criterio**: variantes de iconos sentiment, paleta exacta de chips, copy del placeholder "perfil pendiente". Cualquier decisión de producto en pasos 4 o 6 (visibilidad por defecto por tipo, semántica de tags sugeridos, etc.) la consultaré antes de fijar.