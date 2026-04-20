

# Análisis: Cómo está integrada la RAG hoy

## 1) Arquitectura actual (interna, sin dependencias externas)

```text
┌─────────────────────────────────────────────────────────────────┐
│                       SUBIDA DE DOCUMENTO                       │
│  UploadZone → Storage (bucket: documentos_contratos, privado)   │
│             → INSERT documentos_proyecto (procesado_ia=false)   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
┌──────────────────┐              ┌────────────────────────┐
│ document-classify│              │       rag-ingest        │
│ Gemini 2.5 Flash │              │ Gemini 2.5 Flash multi │
│ → taxonomía      │              │ → texto extraído        │
│ → sensibilidad   │              │ → chunks (2000 chars,   │
│ → resumen 1ª     │              │    overlap 200)         │
│ → fecha doc      │              │ → INSERT document_chunks│
│ UPDATE doc       │              │ + dominio inferido      │
└──────────────────┘              │ UPDATE procesado_ia=true│
                                  └──────────┬─────────────┘
                                             │
                                             ▼
                              ┌────────────────────────────┐
                              │     document_chunks (315k) │
                              │  Postgres FTS español      │
                              │  + columna `dominio`       │
                              │  RLS por visibility/owner  │
                              └────────────┬───────────────┘
                                           │
        ┌──────────────────────────────────┼──────────────────┐
        ▼                                  ▼                  ▼
┌──────────────────┐       ┌────────────────────┐   ┌──────────────────┐
│   rag-proxy      │       │  rag-proxy-v4      │   │ ava-orchestrator │
│ (UI ProyectoRAG) │       │ (no usado en UI)   │   │ tool: rag_search │
│ FTS+ILIKE→Gemini │       │ +team knowledge    │   │ → llama rag-proxy│
│ tool-call JSON   │       │ +signals/threads   │   │                  │
└──────────────────┘       └────────────────────┘   └──────────────────┘
```

**Componentes vivos:**
- `rag-ingest` (chunking + extracción multimodal Gemini)
- `rag-proxy` (consulta principal: FTS español + fallback ILIKE + Gemini con tool-call estructurado)
- `rag-proxy-v4` (versión enriquecida con email_threads/signals; **desplegada pero no llamada desde UI ni orquestador**)
- `document_chunks` con columna `dominio` (sin embeddings vectoriales reales)
- `document_embeddings` (tabla creada pero **vacía / sin uso real**)
- AVA → tool `rag_search` → llama `rag-proxy`

## 2) Estado real en BD (datos en producción)

| Métrica | Valor |
|---|---|
| Documentos totales | **39.814** |
| Documentos indexados (`procesado_ia=true`) | 39.641 (99,6%) |
| Documentos clasificados (`taxonomia_id`) | **1** ❗ |
| Chunks totales | 315.238 |
| Embeddings reales | 0 útiles (tabla `document_embeddings` no se rellena) |
| Taxonomías activas | 15 (las 12 + las 3 nuevas que añadimos) |

**Distribución por dominio:**
- `comunicaciones` (emails) — 237.682 chunks / 35.535 docs
- `centros_comerciales` — 72.759 / 4.112
- `activos` — 2.725 / 6
- `general` — 2.072 / 54

**Llamadas últimos 14 días:** `ava-orchestrator` 57, `rag-proxy:centros_comerciales` solo **2**. La RAG se está usando muy poco directamente.

## 3) Hallazgos importantes

### 🟢 Lo que funciona bien
- Extracción multimodal Gemini para PDF/imagen/PPTX/email — operativa.
- Chunking + dominios + RLS por owner/visibility — correcto.
- AVA puede consultar la RAG vía tool `rag_search`.
- Fallback ILIKE cuando FTS no encuentra nada.

### 🟡 Problemas reales detectados
1. **Casi nada está clasificado** (1/39.814). El botón "Clasificar todo" existe pero no se ha lanzado masivamente sobre el histórico.
2. **`rag-proxy-v4` está desplegada y muerta** — duplica `rag-proxy` con extras (team knowledge, signals) pero nadie la invoca. Es deuda técnica.
3. **`document_embeddings` existe vacía** — diseñada para búsqueda semántica vectorial nunca implementada. Hoy todo es FTS textual + LLM.
4. **Búsqueda solo léxica (FTS)**: si preguntas con sinónimos o conceptos no presentes literalmente, no encuentra nada hasta que el ILIKE rescata por una palabra. No hay similitud semántica real.
5. **Chunks "pobres" de 1 sola fila** (12.455 docs tienen solo 1 chunk, muchos <250 caracteres) — extracción de PDFs muy ligera o imágenes con poco texto. Son documentos que están "indexados" pero aportan poco al RAG.
6. **AVA dispara `rag_search` pocas veces** porque su system-prompt favorece otras tools y porque las respuestas FTS llegan vacías a menudo.
7. **Sin reranking ni control de relevancia** — devuelve los 10 primeros hits FTS sin ordenar por score real.

## 4) Cómo accedes hoy a la RAG (recorrido usuario)

- **Por proyecto**: pestaña "Conocimiento" en `/oportunidades/:id` → `ProyectoRAG` (selector de dominio + caja de pregunta + lista de docs indexados con botón reindexar).
- **Global desde AVA**: pregunta a AVA, el orquestador decide si llamar `rag_search` (filtro automático por dominio).
- **Nada más**. No hay buscador global de RAG fuera de proyecto.

## 5) Plan propuesto (qué arreglar y mejorar)

### A. Higiene inmediata (sin cambios de modelo)
- **A1** Borrar `rag-proxy-v4` (desplegada y huérfana) y la tabla/columna `document_embeddings` si confirmamos no usarla.
- **A2** Lanzar **clasificación retroactiva** de los ~39.800 documentos sin taxonomía vía un job de batch (botón en `/admin` "Reclasificar todo el histórico" con barra de progreso, en chunks de 5 docs paralelos).
- **A3** Añadir **buscador RAG global** en el menú lateral (`/conocimiento`) — actualmente solo se accede dentro de cada oportunidad.

### B. Calidad de la RAG (alto impacto)
- **B1 Embeddings semánticos reales**: rellenar `document_embeddings` con `text-embedding-3-small` (OpenAI, ya tienes `OPENAI_API_KEY`) o usar Gemini embeddings. Modificar `rag-proxy` para hacer **búsqueda híbrida**: FTS + cosine similarity con `pgvector` y rerank.
- **B2 Reranker**: tras recuperar 20 candidatos (10 FTS + 10 vectorial), rerankear con un Gemini Flash dedicado a "rate relevance 0-10 for question X".
- **B3 Chunk smarter**: en `rag-ingest`, detectar documentos cuyo texto extraído sea <300 chars y marcarlos `fase_rag='low_quality'` para reprocesarlos con un prompt Gemini más agresivo.
- **B4 Citas con enlace**: que `rag-proxy` devuelva `documento_id` en cada cita y la UI permita abrir el PDF original directamente desde la respuesta.

### C. Integración con AVA
- **C1** Mejorar el system-prompt del orquestador para que **siempre pruebe `rag_search` primero** cuando la pregunta menciona "documento", "contrato", "informe", nombres de operadores o de proyectos.
- **C2** Cachear en `aba_messages.meta` los chunks usados para que el feedback del usuario alimente `ai_learned_patterns` (ya existe el patrón en V4).

### D. Documentación interna
- **D1** Actualizar `mem://features/ai/rag` (hoy describe "8 dominios", la BD solo tiene 4 activos).
- **D2** Crear `mem://features/ai/rag-architecture` con el diagrama de arriba.

## Detalles técnicos
- Bucket: `documentos_contratos` (privado), `ava_attachments` (privado).
- Chunking actual: 2000 chars + 200 overlap, sin estructura semántica.
- FTS: `to_tsvector('spanish', contenido)` implícito en `textSearch(..., {config:'spanish'})`.
- Para B1 hace falta migración: `CREATE EXTENSION pgvector` (si no está) + columna `embedding vector(1536)` en `document_chunks` con índice ivfflat o hnsw.
- Modelo extracción: `google/gemini-2.5-flash` (16k tokens, multimodal).
- Modelo respuesta RAG: `google/gemini-3-flash-preview`.

## Preguntas antes de implementar
1. ¿Lanzo ya la **clasificación retroactiva masiva** (39.800 docs, ~3-4h en background, coste estimado <5€)?
2. ¿Activamos **embeddings semánticos reales** (B1+B2) o de momento mantenemos solo FTS textual?
3. ¿Borro `rag-proxy-v4` y `document_embeddings` huérfanas, o prefieres conservarlas por si reaprovechamos?
4. ¿Quieres un **buscador RAG global** en el menú lateral (`/conocimiento`) o seguimos solo dentro de cada oportunidad?

