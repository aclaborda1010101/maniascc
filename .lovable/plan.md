## Objetivo

Adoptar `google/gemini-3.5-flash` en AVA en dos frentes:
1. **Reemplazar `gemini-3.1-pro-preview` en toda la cadena Pro** (más barato, más rápido y mejor razonamiento agéntico).
2. **Subir router + síntesis intermedia** de `gemini-2.5-flash` a `gemini-3.5-flash`.

## Cambios técnicos

**Único archivo: `supabase/functions/ava-orchestrator/index.ts`**

| Línea | Antes | Después |
|---|---|---|
| 167 | `PRO_MODEL_FALLBACK = "google/gemini-3.1-pro-preview"` | `= "google/gemini-3.5-flash"` |
| 168 | `TOOL_ROUTER_MODEL = "google/gemini-2.5-flash"` | `= "google/gemini-3.5-flash"` |
| 171 | Comentario `Cadena Pro: claude → gpt-5 → gemini-3.1-pro-preview` | Actualizar a `… → gemini-3.5-flash` |
| 876 | `model: "google/gemini-2.5-flash"` (síntesis intermedia) | `"google/gemini-3.5-flash"` |
| 1813, 1868, 1908, 1919, 1931, 1954 | Referencias literales a `gemini-3.1-pro-preview` en la escalación dinámica y pricing | `gemini-3.5-flash` |
| ~208 (MODEL_PRICING) | — | Añadir entrada `"google/gemini-3.5-flash": { in: 0.30/1M, out: 2.50/1M } × 0.92` (placeholder hasta tener tarifa oficial; ajustable). Mantener la entrada de `gemini-3.1-pro-preview` por compatibilidad histórica en auditoría. |

**Cadena Pro final:** `claude-sonnet-4-5` → `openai/gpt-5` → `google/gemini-3.5-flash` (fallback).

**Opcional incluido:** `contact-extract-signals/index.ts` línea 151 → `gemini-3.5-flash` (mejor extracción JSON al mismo coste).

**Fuera de scope (sin cambios):** RAG/multimodal (`rag-ingest`, `rag-proxy`, `ava-attach-process`, `ava-transcribe`, `document-classify`, `email-bulk-ingest`), smalltalk lite, `ai-forge`, `ai-background-agent`, `generate-match*`.

## Memoria

Actualizar `mem://tech/ai-models` y el `Core` del índice:
- Core actual: `gemini-3.1-pro-preview` → cambiar a `gemini-3.5-flash` como modelo principal.
- Nota: "Desde 2026-05-25 la cadena Pro de AVA termina en `gemini-3.5-flash` (más barato, rápido y mejor que 3.1-pro). RAG/multimodal sigue en `gemini-2.5-flash`."

## Validación

1. Deploy de `ava-orchestrator` (+ `contact-extract-signals`).
2. Probar en `/asistente-ia`:
   - Prompt simple (router) → log `[router]` debe reportar `gemini-3.5-flash`.
   - Prompt complejo / `force_pro` → log `[model-router] synthesis=google/gemini-3.5-flash`.
   - Prompt que dispare escalación → log `[escalation] → gemini-3.5-flash`.
3. Revisar `Consumo`: coste registrado (no 0 €) y latencia menor a la línea base de 3.1-pro.

## Riesgos

- **Pricing real desconocido** para 3.5-flash en Lovable Gateway → el dashboard mostrará coste aproximado hasta confirmar tarifa.
- **Calidad en queries Pro muy complejas**: si en pruebas se nota regresión vs 3.1-pro, rollback de 1 línea (`PRO_MODEL_FALLBACK`) y re-evaluar dejar 3.5-flash solo como router/síntesis.
