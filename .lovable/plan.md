# Simulación A/B: AVA con GPT vs Gemini (temporal, con rollback)

## Aclaración sobre el modelo pedido
No existe ningún modelo llamado **"GPT-5.6 Luna"** ni en el catálogo de Lovable AI ni en la API pública de OpenAI. Los modelos reales de la familia GPT-5 más recientes son: `gpt-5`, `gpt-5.2`, `gpt-5.4`, `gpt-5.5` (y variantes mini/nano).

Como pediste "y si no está en Lovable AI, usa directamente API key de OpenAI" — buena noticia: **`OPENAI_API_KEY` ya está configurada** como secret del proyecto. Propongo usar `gpt-5.5` (el más capaz de la familia, equivalente en gama alta a lo que sugiere "Luna") vía OpenAI directo. Si prefieres otro (gpt-5.4, gpt-5, mini), lo cambio en un parámetro.

## Alcance
Golden-run parcial A/B **+** 3 preguntas manuales de muestra, **temporal**, con **rollback automático a Gemini** al terminar.

## Qué voy a hacer

### 1. Añadir provider OpenAI directo al orquestador
En `supabase/functions/ava-orchestrator/index.ts`, extender `endpointFor(model)` para reconocer prefijo `openai-direct/*` → `https://api.openai.com/v1/chat/completions` con `Authorization: Bearer ${OPENAI_API_KEY}`. No toca la ruta actual del Lovable AI Gateway.

### 2. Flag de A/B por variable de entorno
Nueva env var opcional `AB_SYNTHESIS_MODEL`. Si está puesta, `DEFAULT_MODEL`, `TOOL_ROUTER_MODEL` y `SMALLTALK_MODEL` se sobrescriben con ese valor. Si está vacía → comportamiento actual (Gemini). Actualizar `MODEL_PRICING` con la tarifa de gpt-5.5 para que el coste se calcule bien.

### 3. Ejecutar la simulación
1. Baseline Gemini: correr `golden-run` con `run_name='ab_gemini_baseline'` (sin flag).
2. Set flag `AB_SYNTHESIS_MODEL=openai-direct/gpt-5.5` (via `set_secret`).
3. Correr `golden-run` con `run_name='ab_gpt55_luna'`.
4. Lanzar 3 preguntas manuales contra el orquestador con GPT activo:
   - "¿cuál es nuestro último proyecto?"
   - "¿qué sabes de La Milla?"
   - "¿cuántos operadores tenemos en Madrid?"
5. **Rollback**: borrar `AB_SYNTHESIS_MODEL` → vuelve a Gemini automáticamente.

### 4. Reportar comparativa
Tabla lado a lado:

| Métrica | Gemini (baseline) | GPT-5.5 |
|---|---|---|
| Accuracy global | % | % |
| Hallucination rate | % | % |
| Latency p50 / p95 | ms | ms |
| Coste medio / pregunta | € | € |
| Preguntas ganadas por cada modelo | n | n |

Más las 3 respuestas manuales literales de cada modelo para juicio cualitativo.

## Qué NO voy a tocar
- RAG, harness, seguridad, UI.
- Cadena Pro ni escalación (siguen igual, se miden solo el camino estándar).
- Ningún default se queda cambiado tras el test.

## Detalles técnicos
- Cambio mínimo: ~30 líneas en `ava-orchestrator/index.ts` (nuevo branch en `endpointFor` + lectura de `AB_SYNTHESIS_MODEL` en la sección MODEL ROUTER).
- Nuevo secret temporal: `AB_SYNTHESIS_MODEL` (se borra al final).
- Cada corrida del golden-run tarda ~5 min; total ~15 min incluyendo las 3 preguntas manuales.

## Riesgos honestos
- GPT-5.5 vía OpenAI directo probablemente será **2–4× más lento** que gemini-3.5-flash (los modelos "razonadores" GPT-5.x tardan más). Es lo que queremos medir.
- El coste por respuesta subirá notablemente (gpt-5.5 ≈ 10–20× vs flash). No hay riesgo de gasto masivo: son ~15 preguntas × 2 modelos.
- Si OpenAI devuelve algún parámetro incompatible (los GPT-5.x tienen restricciones sobre `temperature`, `max_tokens`), lo capturo y ajusto el body (por eso conviene un branch dedicado y no reutilizar el body de Gemini tal cual).

¿Apruebas o cambio el modelo GPT objetivo?
