
# Plan aprobado: rag_hybrid_search v2 + cache integrado en rag-proxy

## 1. Migración SQL

- `DROP` + `CREATE OR REPLACE` de `public.rag_hybrid_search` (firma de 6 parámetros) con:
  - `v_tsquery` cacheada en `DECLARE` (una sola tokenización de la pregunta).
  - Narrativas separadas en `narr_fts` (usa GIN) y `narr_vec` (usa HNSW).
  - `DISTINCT ON (u.id)` en lugar del `GROUP BY` sobre `contenido` y `metadata`.
  - `RETURNS TABLE` extendido con `owner_id uuid` y `visibility text` propagados desde cada CTE → arregla el filtro post-RPC roto en `rag-proxy` (líneas 83-85).
  - `to_tsvector('spanish', c.contenido)` inline (la columna materializada se hará en una migración separada cuando el usuario la lance desde el SQL Editor).
- Eliminar también la sobrecarga vieja de 5 parámetros si existe.
- `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` y `GRANT EXECUTE ... TO service_role` sobre `get_cached_embedding`, `cache_query_embedding`, `cleanup_query_cache`. Limpia 3 warnings 0028 del linter.

## 2. Edge function `supabase/functions/rag-proxy/index.ts`

- Sustituir `embedQuery(question, key)` por `getQueryEmbedding(admin, question, key)`:
  - Helper `parseEmbedding(raw)` que acepta array directo o string serializado de pgvector.
  - `console.time("rag:embed:cache-lookup")` → `admin.rpc("get_cached_embedding", { p_query: question })`. Si HIT, devuelve y log `rag:embed: HIT (768d)`.
  - Si MISS: `console.time("rag:embed:gateway")` → `fetch` al Lovable Gateway (igual que hoy, mismo modelo `google/text-embedding-004`).
  - Fire-and-forget `admin.rpc("cache_query_embedding", { p_query, p_embedding })` con `.then` que solo loggea error.
- Envolver la llamada a `rag_hybrid_search` con `console.time("rag:hybrid")`.
- Arreglar filtro post-RPC: como la nueva RPC ahora sí devuelve `owner_id` y `visibility`, el filtro `c.owner_id === userId || ["shared","global"].includes(c.visibility)` ya funcionará correctamente y dejará de descartar todo.

## 3. Validación

- `supabase--deploy_edge_functions(["rag-proxy"])`.
- Llamar 2 veces a `/rag-proxy` con la misma pregunta vía `curl_edge_functions`.
- Leer `edge_function_logs` y confirmar:
  - 1ª llamada: aparece `rag:embed:gateway` (~300-500ms) y NO aparece `rag:embed: HIT`.
  - 2ª llamada: aparece `rag:embed: HIT` y `rag:embed:cache-lookup` < 50ms.
- `SELECT query_text, hit_count FROM query_embeddings_cache ORDER BY last_used_at DESC LIMIT 5` → `hit_count >= 2`.

## Fuera de alcance

- `ALTER TABLE document_chunks ADD COLUMN fts_vector ... GENERATED STORED` (timeout HTTP). El usuario lo lanzará desde SQL Editor; tras eso, una migración corta cambiará `to_tsvector(...)` por `c.fts_vector`.
- HNSW parciales por dominio (fase 2).

## Riesgos

- La nueva RPC añade columnas al `RETURNS TABLE`. Único caller: `rag-proxy`. Lo desplegamos en el mismo turno → ventana sin riesgo.
- Si un cliente antiguo cacheado en el navegador llamara a la RPC con la firma vieja, recibirá las columnas extra (no rompe — es JSON adicional).
