# Plan: Schema Zod para validar PerfilIA

Crear `src/lib/perfilIaSchema.ts` que sirva como **contrato ejecutable** entre el generador (Fran/Gorka) y la UI. Cualquier output que no pase este schema no debe insertarse en `contactos.perfil_ia`.

Zod ya está instalado (`^3.25.76`), así que no hay que añadir deps.

## Archivo único: `src/lib/perfilIaSchema.ts`

### Estructura

1. **Imports**
   - `import { z } from "zod"`
   - `import type { PerfilIA } from "@/types/perfilIa"`

2. **Schemas atómicos**
   - `SentimentSchema` = `z.enum(["good", "neutral", "bad"])`
   - `EvolutionStatusSchema` = `z.enum(["mejorando", "estable", "deteriorando", "dormida"])` — coincide exactamente con el spec aprobado
   - `IsoMonthSchema` = `z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be YYYY-MM")`
   - `IsoDateSchema` = `z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")`
   - `IsoDateTimeSchema` = `z.string().datetime({ offset: true })` (ISO 8601 con TZ)
   - `PreferredDaySchema` = `z.enum(["lun", "mar", "mié", "jue", "vie", "sáb", "dom"])`

3. **Schemas compuestos** (espejo 1:1 de las interfaces en `src/types/perfilIa.ts`)
   - `TimelinePointSchema` — `month` (IsoMonth), `count` ≥ 0 int, `sentiment`, `label` opcional
   - `PerfilStatsSchema` — counts ≥ 0, `first_contact`/`last_contact` IsoDateTime, `days_since_last` ≥ 0 int, `initiated_by_us_pct` int 0–100, `trend_30d_pct` int (puede ser negativo, sin tope), `channels` array de strings, `preferred_hours` array de int 0–23, `preferred_days` array de PreferredDay
   - `KeyEventSchema` — `date` IsoDate, `tipo` string no vacío, `description` string no vacío, `score`
   - `EvolutionBlockSchema` — `status`, `summary` string, `recent_evolution` array de `{ when: string, desc: string }`
   - `PerfilIaSchema` (root) — todos los bloques + `datos_clave` array de strings + `generated_at` IsoDateTime

4. **Función pública: `validatePerfilIA`**

```ts
export function validatePerfilIA(
  obj: unknown
): { ok: true; data: PerfilIA } | { ok: false; error: string; issues: z.ZodIssue[] }
```

   - Usa `PerfilIaSchema.safeParse(obj)`
   - En éxito: `{ ok: true, data }`
   - En fallo: `{ ok: false, error: <mensaje legible "campo: motivo" agregado>, issues: result.error.issues }`
   - El `error` es un string compacto tipo `"timeline[2].month: must be YYYY-MM; stats.initiated_by_us_pct: must be ≤ 100"` para logs/alerts del generador.

5. **Export adicional**
   - `export { PerfilIaSchema }` para que un consumidor avanzado (ej. tests) pueda hacer `parse` directo.
   - `export type ValidationResult = ReturnType<typeof validatePerfilIA>`

### Reglas de validación clave (resumen para Fran/Gorka)

| Campo | Regla |
|---|---|
| `evolution.status` | `mejorando` \| `estable` \| `deteriorando` \| `dormida` |
| `*.sentiment` / `*.score` | `good` \| `neutral` \| `bad` |
| `timeline[].month` | `YYYY-MM` |
| `key_events[].date` | `YYYY-MM-DD` |
| `stats.first_contact` / `last_contact` / `generated_at` | ISO 8601 con offset (`...Z` o `±HH:MM`) |
| `stats.preferred_hours[]` | enteros 0–23 |
| `stats.preferred_days[]` | `lun`/`mar`/`mié`/`jue`/`vie`/`sáb`/`dom` |
| `stats.initiated_by_us_pct` | entero 0–100 |
| `*.count`, `total_messages`, `days_since_last` | enteros ≥ 0 |

### No se cambia nada más

- No tocamos `src/types/perfilIa.ts` (el tipo TS ya está bien).
- No tocamos el mock ni los componentes.
- No tocamos edge functions — la validación es opt-in en el generador.

## Uso esperado por el generador

```ts
import { validatePerfilIA } from "@/lib/perfilIaSchema";

const result = validatePerfilIA(generatedJson);
if (!result.ok) {
  console.error("Perfil inválido:", result.error);
  return; // no insertar
}
await supabase.from("contactos").update({ perfil_ia: result.data }).eq("id", id);
```

Equivalente Python: replicar enums + regex con `pydantic` o `jsonschema`. El plan no incluye generar el .py — solo el contrato TS.
