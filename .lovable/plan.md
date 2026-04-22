
Objetivo: corregir el cron roto que intenta crear el índice HNSW de `document_chunks.embedding`, dejar un único job válido y verificar que el índice empiece a construirse.

Estado actual confirmado:
- `pg_cron`, `pg_net` y `vector` ya están habilitados.
- El índice `public.idx_document_chunks_embedding_hnsw` no existe todavía.
- Sigue activo el job `build-hnsw-document-chunks-once` con la lógica antigua basada en `pg_stat_activity`, que es la causa probable de que nunca entre al `CREATE INDEX`.

Implementación
1. Limpiar el cron actual
- Desprogramar el job roto `build-hnsw-document-chunks-once`.
- Limpiar también cualquier job previo con nombre parecido (`build-hnsw-doc-chunks`) para evitar duplicados si hubo intentos parciales.

2. Crear el nuevo cron con mutex correcto
- Programar un único job por minuto llamado `build-hnsw-doc-chunks`.
- Usar la versión con:
  - comprobación de existencia en `pg_indexes`
  - `pg_try_advisory_xact_lock(7842341)` como mutex real
  - `set_config('maintenance_work_mem', '4GB', true)`
  - `set_config('max_parallel_maintenance_workers', '7', true)`
  - `CREATE INDEX idx_document_chunks_embedding_hnsw ON public.document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`
  - `cron.unschedule('build-hnsw-doc-chunks')` al terminar o si detecta que el índice ya existe

3. Aplicarlo como operación de datos, no como migración
- Esto no es un cambio de esquema persistente del repo, sino una operación operativa sobre `cron.job`.
- Debe ejecutarse con la herramienta de base de datos para `SELECT/INSERT/UPDATE/DELETE`, no mediante migration SQL.

4. Verificación inmediata tras lanzar el fix
- Confirmar que:
  - el job antiguo ya no está
  - el job nuevo existe y queda activo
  - el índice sigue sin existir al principio, pero el cron ya está listo para el siguiente tick

5. Verificación a los 2–5 minutos
- Revisar `pg_indexes` para comprobar si ya aparece `idx_document_chunks_embedding_hnsw`.
- Si aparece, confirmar que el cron se ha desprogramado solo.
- Si no aparece, revisar `cron.job_run_details` / estado del último run para detectar si falló por memoria, timeout interno o bloqueo.

Validación final esperada
- `pg_indexes` debe devolver el nuevo índice HNSW sobre `public.document_chunks(embedding vector_cosine_ops)`.
- `cron.job` no debe conservar jobs HNSW activos una vez creado el índice.
- La búsqueda vectorial de RAG debería bajar de varios segundos a latencias del orden de cientos de ms.

Detalles técnicos
- El problema no está en la extensión ni en la tabla: ambas están listas.
- El fallo está en la lógica del cron actual, que usa `pg_stat_activity` y puede auto-detectarse a sí mismo.
- El cambio a advisory lock evita ese falso positivo y garantiza que solo un worker construya el índice.
- No hace falta tocar frontend, edge functions ni `rag_hybrid_search` para este fix; solo la configuración del job programado en base de datos.
