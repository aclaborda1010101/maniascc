## Plan: completar migración halfvec + VACUUM desde el servidor

Como no tienes acceso al SQL Editor, lo ejecuto yo vía la herramienta de migraciones de Lovable Cloud, troceado en pasos pequeños para que ninguno supere el timeout HTTP.

### Pasos (cada uno = una migración separada)

1. **Drop índice HNSW pesado**
   ```sql
   SET statement_timeout = 0;
   DROP INDEX IF EXISTS document_chunks_embedding_idx;
   DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx;
   ```
   Rápido (<5 s). Libera los 2,5 GB del índice y permite el ALTER sin tener que reindexar a la vez.

2. **Convertir columna `embedding` a `halfvec(768)`**
   ```sql
   SET statement_timeout = 0;
   ALTER TABLE document_chunks
     ALTER COLUMN embedding TYPE halfvec(768)
     USING embedding::halfvec(768);
   ```
   Es el paso largo (~2-4 min sobre 438k filas). Las migraciones de Lovable Cloud se ejecutan en background sin el timeout HTTP de las edge functions, así que aquí sí cabe.

3. **Recrear índice HNSW sobre halfvec**
   ```sql
   SET statement_timeout = 0;
   SET maintenance_work_mem = '512MB';
   CREATE INDEX document_chunks_embedding_idx
     ON document_chunks
     USING hnsw (embedding halfvec_cosine_ops);
   ```
   ~2-3 min. El índice resultante pesa ~1,2 GB (mitad que antes).

4. **Actualizar `rag_hybrid_search` para castear el embedding de query**
   La función recibe `vector` y ahora la columna es `halfvec`. Hay que castear en las comparaciones:
   ```sql
   ... ORDER BY c.embedding <=> p_query_embedding::halfvec(768) ...
   ```
   Reemplazo en los dos sitios donde se usa `<=>` (chunks y narrativas — si `entity_narratives.embedding` sigue siendo `vector`, esa parte no se toca).

5. **VACUUM FULL** sobre `document_chunks`
   ```sql
   VACUUM FULL document_chunks;
   ```
   Libera el espacio físico de los 127k chunks borrados + los vectores antiguos. La DB debería bajar de 7,8 GB → ~3-4 GB.

6. **Verificación**
   - `SELECT pg_size_pretty(pg_total_relation_size('document_chunks'))`
   - Una query RAG de prueba (lanzando `rag-proxy` con una pregunta cualquiera) para confirmar que el cast funciona y no rompo la búsqueda.

### Riesgos y mitigación

- **Si el paso 2 también supera el timeout interno de la migración**, hago un plan B: añado columna nueva `embedding_h halfvec(768)`, copio por lotes de 50k filas en migraciones separadas, swap de columnas. Más pasos pero cada uno cabe seguro.
- **Durante el paso 2-3**, la búsqueda RAG estará degradada (sin índice → scan secuencial). Son ~5 min. Si prefieres ventana de noche, dímelo.
- **`rag-embed-chunks` y `rag-ingest`** siguen insertando `vector` plano; Postgres lo casteará a halfvec automáticamente al insertar, no hay que tocarlos.

### Lo que NO toco en este plan

- Tier de la instancia Cloud — eso lo bajas tú desde Backend → Lovable Cloud → Advanced settings cuando la DB esté en ~3 GB.
- Cron de limpieza, dedupes ya ejecutados, etc. — ya hechos en sesiones previas.

¿Lo ejecuto?
