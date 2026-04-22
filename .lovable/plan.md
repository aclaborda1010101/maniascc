

# Migrar embeddings antiguos + index HNSW + alinear modelo de query

## Diagnóstico confirmado

| Aspecto | Estado |
|---|---|
| `document_chunks` total | 565.413 |
| `document_chunks.embedding` poblados | **0** |
| `document_chunks.embedding` tipo declarado | **`vector(1536)`** (OpenAI text-embedding-3-small) |
| `document_embeddings.embedding_json` | 464.635 (todos vinculados a chunks vía `chunk_id`) |
| Modelo de los 464k embeddings antiguos | **`text-embedding-004`** (Gemini, **768 dims**) |
| `rag-proxy` (búsqueda) embebe queries con | OpenAI 1536 |
| `rag-embed-chunks` (indexación) embebe con | OpenAI 1536 |

**Bloqueo crítico**: la migración tal como la propones **fallará** con `expected 1536 dimensions, got 768` porque la columna está dimensionada para OpenAI y los datos antiguos son Gemini.

Hay dos rutas posibles, mutuamente excluyentes (no se pueden mezclar dimensiones distintas en una misma columna `vector(N)` ni en un mismo índice HNSW):

## Opción A — Conservar los 464k Gemini (rápido, casi cero coste)

Aprovechar los embeddings ya calculados, redimensionar la columna y alinear `rag-proxy` + `rag-embed-chunks` a Gemini 768.

### Migraciones SQL
1. **Drop temporal del índice FTS solo si bloquea el ALTER** (no debería).
2. `ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(768);` — válido solo si la columna está vacía (lo está).
3. **Backfill** desde `document_embeddings`:
   ```sql
   UPDATE document_chunks c
   SET embedding = (
     SELECT array(SELECT jsonb_array_elements_text(e.embedding_json))::float8[]::vector(768)
     FROM document_embeddings e
     WHERE e.chunk_id = c.id AND e.embedding_json IS NOT NULL
     LIMIT 1
   )
   WHERE c.embedding IS NULL
     AND EXISTS (SELECT 1 FROM document_embeddings e WHERE e.chunk_id = c.id);
   ```
   Se ejecutará por lotes de ~50k vía `WHERE c.id IN (...)` para evitar timeout (la API Supabase ha cancelado consultas largas en el diagnóstico).
4. `CREATE INDEX idx_document_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);`

### Cambios en código
- `supabase/functions/rag-proxy/index.ts`: cambiar `embedQuery` para usar **Lovable AI Gateway → google/text-embedding-004** (768 dims, sin coste de API key OpenAI). Endpoint: `https://ai.gateway.lovable.dev/v1/embeddings` con header `LOVABLE_API_KEY` ya disponible.
- `supabase/functions/rag-embed-chunks/index.ts`: ídem, sustituir OpenAI por Gemini 768 y constantes `EMBED_MODEL = "google/text-embedding-004"`, `EMBED_DIM = 768`.
- Eliminar dependencia de `OPENAI_API_KEY` para embeddings.

### Pendiente residual
Quedan ~100k chunks sin vector (565k − 464k). Se encolan en `rag_processing_queue` con tarea `embed` y se procesan desde `/conocimiento` con el botón "Procesar lote" (ya existe).

## Opción B — Recalcular todo con OpenAI 1536 (caro, lento)

Mantener la columna `vector(1536)` y descartar los 464k Gemini. Requiere `OPENAI_API_KEY` configurada y tiene coste real (~$5-10 para 565k chunks con `text-embedding-3-small`). Tarda horas. No recomendado salvo motivo estratégico.

## Recomendación

**Opción A**, en este orden:

1. **Migración 1 (SQL)**: redimensionar columna a `vector(768)` (vacía, instantáneo).
2. **Migración 2 (SQL)**: backfill por lotes desde `document_embeddings.embedding_json` → vector(768). Estimado: 5-15 min en background.
3. **Edge functions**: actualizar `rag-proxy` y `rag-embed-chunks` a Gemini 768 vía Lovable AI Gateway.
4. **Migración 3 (SQL)**: crear índice HNSW con `vector_cosine_ops`.
5. **Encolar los ~100k restantes** vía `rag-batch-orchestrator` (`enqueue_all` con `task_type: "embed"`) y procesarlos desde `/conocimiento`.
6. **Validación**: ejecutar 5 queries de control en `rag-proxy` y verificar `hits > 0` con `hybrid: true`.

## Lo que NO se toca
- `rag_hybrid_search` (la función ya está bien, opera sobre `embedding` sin importar dimensión).
- Estructura de `document_chunks` salvo el tipo de la columna `embedding`.
- `document_embeddings` (se conserva como histórico/respaldo, no se borra).
- UI ni lógica de `/conocimiento`.

## Pregunta antes de implementar

¿Vamos con **Opción A** (Gemini 768, aprovecha los 464k existentes, sin coste de API key OpenAI) o prefieres **Opción B** (recalcular todo con OpenAI 1536)?

