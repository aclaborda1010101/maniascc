
## Objetivo

Reducir el gasto **horario** de Lovable Cloud (instancia + actividad continua) atacando las dos únicas causas que corren 24/7 sin que tú hagas nada:

1. **Tamaño de la BD** (7,84 GB → forzando instancia grande). El 96% es `document_chunks` (7,5 GB / 565.413 filas).
2. **Cron `process-email-queue`** ejecutándose cada 30s (2.880 ejec/día).

---

## Diagnóstico actual

| Concepto | Valor |
|---|---|
| BD total | 7,84 GB |
| `document_chunks` | 7.565 MB · 565.413 filas |
| `documentos_proyecto` | 97 MB · 68.967 docs (todos cargados en abril 2026, un batch) |
| Chunks huérfanos | 0 |
| Chunks sin embedding | 0 |
| Cron emails | cada 30s, 24/7 |
| Llamadas IA últimas 24h | 0 |

Reparto de chunks por dominio:

```text
centros_comerciales   134.340   518 MB
legal                 117.136   451 MB
comunicaciones        104.162   413 MB
financiero             63.684   247 MB
personal               56.468   212 MB
urbanismo              35.325   135 MB
administrativo         29.081   110 MB
general                25.217    98 MB
```

No hay basura evidente: la BD es grande porque **se indexó masivamente un corpus de 69k documentos** y los embeddings de 768 dim ocupan ~3 KB por chunk.

---

## Plan de acción

### 1. Ralentizar el cron de emails (impacto inmediato, sin riesgo)

Pasar de cada 30s a **cada 2 minutos**. Reduce ejecuciones de 2.880 → 720/día (−75%). Si la cola está vacía la mayor parte del tiempo, el impacto en latencia de envío es despreciable.

```sql
SELECT cron.unschedule('process-email-queue');
SELECT cron.schedule(
  'process-email-queue',
  '*/2 * * * *',
  $$ <mismo cuerpo actual> $$
);
```

### 2. Auditoría de `document_chunks` antes de borrar nada

Antes de purgar, quiero confirmar contigo qué se puede eliminar. Voy a generar un informe con:

- Documentos nunca citados por RAG (cruzar `documentos_proyecto.id` contra citas en `auditoria_ia` y `ava_messages.meta`).
- Documentos > 6 meses sin acceso.
- Duplicados por `hash_md5`.
- Top 50 documentos más pesados (chunks generados).

### 3. Recortes posibles según el informe (a aprobar uno por uno)

| Acción | Ahorro estimado | Riesgo |
|---|---|---|
| Borrar duplicados por `hash_md5` | 5–15% de chunks | Nulo |
| Purgar dominio `general` poco usado | ~98 MB | Bajo |
| Borrar docs sin citaciones en 6 meses | 20–40% | Medio (revisión previa) |
| Re-chunking con tamaño 2x (1500 → 3000 chars) | ~50% del total | Medio (requiere re-ingest) |

Con un recorte combinado realista se puede bajar a **~3–4 GB**, lo que **probablemente permite un tier de instancia menor** y reduce el coste fijo horario de forma estructural.

### 4. Limpieza de logs históricos (ahorro pequeño pero gratis)

```sql
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';
DELETE FROM auditoria_ia WHERE created_at < now() - interval '90 days';
```

### 5. Verificación

Tras aplicar 1, 2 y 4:

- `SELECT pg_size_pretty(pg_database_size(current_database()));`
- Comprobar en **Backend → Advanced settings** si aparece opción de bajar de instancia.
- Confirmar que el cron sigue procesando emails correctamente (mirar `email_send_log`).

---

## Detalles técnicos

- El cron se modifica con `cron.unschedule` + `cron.schedule` (requiere `pg_cron`, ya activo).
- Las purgas usan `DELETE` normales, NO migración. Borrar chunks no rompe nada porque RAG hace fallback a FTS y a búsqueda por palabras (visto en `rag-proxy/index.ts`).
- Re-chunking implicaría re-ejecutar `rag-ingest` con `CHUNK_SIZE` mayor, no entra en este plan inicial.
- El cambio de tier de instancia lo haces tú manualmente desde **Backend → Advanced settings** una vez liberado el espacio.

---

## Lo que NO incluye este plan

- Cambios en el modelo de IA del orchestrator (ya hablado, va aparte si quieres).
- Re-ingestar documentos con chunk size mayor (segunda fase, tras confirmar ahorros de fase 1).
- Tocar buckets de storage (`documentos_*`, `ava_attachments`) — pendiente de pedir tamaños si quieres.
