
# Plan: Optimización RAG — fase 1 (función híbrida + cache de embeddings)

## Objetivo

Reducir la latencia de cada consulta RAG eliminando trabajo redundante en SQL y evitando llamar al gateway de embeddings cuando la pregunta ya se ha hecho antes.

Objetivo medible:
- **Cache HIT**: respuesta < 50 ms en la fase de embedding (hoy 300–500 ms).
- **`rag_hybrid_search`**: ~30–40% menos tiempo CPU eliminando doble `to_tsvector` y `GROUP BY` sobre texto.

## Hallazgos previos a aplicar tu propuesta

1. **`entity_narratives` está vacía hoy (0 filas)** y solo tiene HNSW, **no tiene índice GIN de FTS**. La CTE `narr_fts` que propones haría seq-scan en cuanto se pueble. Hay que añadir el índice GIN.
2. **El embedding NO se pide a Google directamente** sino al **Lovable AI Gateway** (`ai.gateway.lovable.dev/v1/embeddings`, modelo `google/text-embedding-004`). El cache sigue siendo igual de valioso, solo cambia el `fetch` que hay que rodear.
3. **Bug latente en `rag-proxy`** (líneas 83-85): filtra el resultado por `c.owner_id` y `c.visibility`, **pero `rag_hybrid_search` no devuelve esas columnas** → ese filtro hoy descarta todo y siempre cae al fallback FTS. Aprovechamos esta migración para arreglarlo añadiendo `owner_id` y `visibility` al `RETURNS TABLE`.
4. `pg_cron` y `pgcrypto` ya están instalados → la limpieza programada y `digest()` funcionan sin extensiones nuevas.

## Cambios a aplicar

### 1. Migración SQL (schema)

```text
ALTER TABLE document_chunks
  ADD COLUMN fts_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', contenido)) STORED;

CREATE INDEX idx_chunks_fts_stored ON document_chunks USING gin(fts_vector);
DROP INDEX idx_document_chunks_fts;          -- el viejo basado en expresión

CREATE INDEX idx_narratives_fts ON entity_narratives
  USING gin(to_tsvector('spanish', narrativa));   -- faltaba

CREATE TABLE query_embeddings_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash   text NOT NULL UNIQUE,
  query_text   text NOT NULL,
  embedding    vector(768) NOT NULL,
  hit_count    integer DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  expires_at   timestamptz DEFAULT now() + interval '7 days'
);
CREATE INDEX idx_qec_hash    ON query_embeddings_cache(query_hash);
CREATE INDEX idx_qec_expires ON query_embeddings_cache(expires_at);
ALTER TABLE query_embeddings_cache ENABLE ROW LEVEL SECURITY;
-- RLS: solo service_role puede leer/escribir (las RPC son SECURITY DEFINER)
```

> **Nota**: añadir la columna generada en 565K filas tarda 1–3 minutos y bloquea escrituras en la tabla durante el rewrite. Lo avisamos en el mensaje al usuario antes de lanzar.

### 2. Funciones SQL

- **`rag_hybrid_search`** reescrita con tu propuesta + dos ajustes:
  - Añadir `owner_id uuid` y `visibility text` al `RETURNS TABLE` y propagarlos en cada CTE (arregla el bug de filtrado).
  - `v_tsquery` cacheada en `DECLARE` (una sola tokenización).
  - `c.fts_vector @@ v_tsquery` en lugar de `to_tsvector(...) @@ ...`.
  - Narrativas separadas en `narr_fts` y `narr_vec` para que cada rama use su índice.
  - `DISTINCT ON (u.id)` con `ORDER BY u.id, fts_rank DESC NULLS LAST, vec_distance ASC NULLS LAST` en lugar del `GROUP BY` sobre texto/jsonb.
- **`get_cached_embedding(text) RETURNS vector`** — `SECURITY DEFINER`, hace `UPDATE ... RETURNING` para registrar hit y extender TTL en una sola query.
- **`cache_query_embedding(text, vector) RETURNS void`** — `SECURITY DEFINER`, upsert por hash.
- **`cleanup_query_cache() RETURNS integer`** — borra expirados.
- **`pg_cron`**: `cron.schedule('cleanup-query-embeddings-cache','0 4 * * *', $$SELECT public.cleanup_query_cache()$$)`.

Hash normalizado: `encode(digest(lower(trim(regexp_replace(p_query,'\s+',' ','g'))),'sha256'),'hex')`.

### 3. Edge function `supabase/functions/rag-proxy/index.ts`

Cambios mínimos quirúrgicos:

- Refactor `embedQuery` → `getQueryEmbedding(question)` que:
  1. `admin.rpc('get_cached_embedding', { p_query: question })` → si devuelve vector, úsalo.
  2. Si no, llama al Lovable Gateway (mismo `fetch` que hoy, no cambia el endpoint).
  3. Fire-and-forget `admin.rpc('cache_query_embedding', { p_query, p_embedding })`.
  4. Logs `console.time` / `console.timeEnd` en cada fase para que podamos medir el impacto real en los logs de la edge function.
- Quitar el filtro post-RPC roto de las líneas 83-85 — ya no hace falta porque la RPC ahora devuelve `owner_id`/`visibility` y podemos filtrar correctamente (o, mejor, mover el filtro **dentro** de las CTEs de la función para no traer chunks ajenos a la edge en absoluto). Decisión: lo mantenemos en SQL para minimizar payload de red.

### 4. Lo que NO hacemos en esta fase

- **Índices HNSW parciales por dominio** (legal, centros_comerciales, comunicaciones). Lo dejamos para fase 2 cuando midamos cuánto impacto tiene el filtro post-HNSW con el cache ya activo.
- **`SET LOCAL hnsw.ef_search`** dinámico — esperamos a ver si sigue siendo cuello tras los cambios.
- Reembedding de chunks ni cambios en `rag-embed-chunks`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `ALTER TABLE ADD COLUMN GENERATED` bloquea escrituras 1-3 min | Lanzar migración fuera de horas pico; avisar al usuario antes |
| Cambiar `RETURNS TABLE` rompe llamadas con tipos antiguos | Solo hay 1 caller (`rag-proxy`); lo actualizamos en el mismo deploy |
| Cache devuelve embedding obsoleto si cambiamos modelo | TTL de 7 días + queda invalidado al hacer `TRUNCATE` manual; documentado en comentario de la tabla |
| `entity_narratives` sigue vacía → CTEs `narr_*` añaden overhead mínimo | Aceptable: ambas hacen lookup indexado y devuelven 0 filas en <1ms |

## Cómo validamos el resultado

1. Tras el deploy, ejecutar la misma pregunta dos veces y comparar logs de `rag-proxy`:
   - 1ª: `1b-google-embed: ~400ms`
   - 2ª: `1a-cache-lookup: ~3ms` + `Cache HIT`
2. `EXPLAIN ANALYZE` de la nueva `rag_hybrid_search` con un embedding sintético, comparado con el baseline anterior (~85 ms para FTS+vec con filtro de dominio).
3. Verificar en `query_embeddings_cache` que `hit_count` empieza a subir en queries repetidas.

¿Procedemos con esto?
