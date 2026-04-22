

# Encolar y procesar los 100.890 chunks sin embedding (con manejo de docs grandes)

Insertar 307 tareas `embed` en `rag_reprocess_queue`, drenar la cola con `rag-batch-orchestrator`, y blindar el flujo contra el caso borde de documentos con >500 chunks pendientes (PDFs escaneados con OCR).

## Estado confirmado

- 565.413 chunks totales · 464.523 con embedding · **100.890 sin embedding**
- 307 `documento_id` únicos afectados
- Cola `rag_reprocess_queue` vacía
- Schema verificado: `documento_id`, `task_type`, `estado` (`pending|processing|done|error`), `intentos`, `error_msg`, único en `(documento_id, task_type)`

## Cambios

### 1. Subir el límite de `rag-embed-chunks` de 500 → 2000 chunks/invocación

Archivo: `supabase/functions/rag-embed-chunks/index.ts`, línea de `.limit(500)`.

- Cambiar a `.limit(2000)` para que un solo paso cubra incluso adjuntos OCR grandes (329 chunks/doc promedio, pero outliers pueden superar 500).
- Sigue procesando en lotes internos de `BATCH=50` contra el gateway, así que 2000 chunks ≈ 40 sub-llamadas al embeddings endpoint, holgadamente dentro de los ~150s de timeout edge.
- Idempotente: la query filtra por `embedding IS NULL`, nunca toca lo ya embebido.

### 2. Migration: encolar 1 tarea `embed` por documento pendiente

```sql
INSERT INTO public.rag_reprocess_queue (documento_id, task_type, estado, intentos)
SELECT DISTINCT c.documento_id, 'embed', 'pending', 0
  FROM public.document_chunks c
 WHERE c.embedding IS NULL
   AND c.documento_id IS NOT NULL
ON CONFLICT (documento_id, task_type) DO NOTHING;
```

Resultado esperado: ~307 filas `pending`.

### 3. Drenar la cola (ejecución desde sandbox)

Script que invoca `rag-batch-orchestrator` con `mode: "process_batch"`, `task_type: "embed"`, `batch_size: 10`, en bucle hasta `remaining=0`:

```ts
while (true) {
  const { data } = await supabase.functions.invoke("rag-batch-orchestrator", {
    body: { mode: "process_batch", task_type: "embed", batch_size: 10 },
  });
  console.log(data); // { processed, ok, ko, remaining }
  if (!data || data.remaining === 0) break;
}
```

### 4. Segunda pasada para residuos (caso borde docs grandes)

Tras el primer drain, si quedan >1.000 chunks `embedding IS NULL`, reencolar los `documento_id` que aún tienen huecos y volver a drenar:

```sql
INSERT INTO public.rag_reprocess_queue (documento_id, task_type, estado, intentos)
SELECT DISTINCT c.documento_id, 'embed', 'pending', 0
  FROM public.document_chunks c
 WHERE c.embedding IS NULL AND c.documento_id IS NOT NULL
ON CONFLICT (documento_id, task_type)
DO UPDATE SET estado = 'pending', intentos = 0, error_msg = NULL
WHERE rag_reprocess_queue.estado IN ('done', 'error');
```

Y relanzar el bucle de drenado.

### 5. Verificación final

```sql
SELECT
  count(*) FILTER (WHERE embedding IS NULL) AS sin_embedding,
  count(*) FILTER (WHERE embedding IS NOT NULL) AS con_embedding
FROM document_chunks;

SELECT estado, count(*) FROM rag_reprocess_queue
 WHERE task_type = 'embed' GROUP BY 1;
```

Objetivo: `sin_embedding < 5.000` (residuo de chunks con texto vacío) y cola en `done` salvo errores irrecuperables.

## Detalles técnicos

- **1 edit de código** (`rag-embed-chunks/index.ts`: límite 500 → 2000), **1 migration** (encolado inicial), **1 script de drenado** ejecutado desde sandbox, **1 INSERT/UPSERT condicional** opcional para segunda pasada.
- Sin cambios en `rag-batch-orchestrator` — ya soporta este flujo nativamente.
- Coste embeddings Gemini `text-embedding-004` vía Lovable AI Gateway: 0 € en plan actual.
- Cero riesgo sobre datos existentes (filtro `embedding IS NULL`).
- Documentos con fallo persistente (3 intentos) quedan como `estado='error'` con `error_msg` legible — no bloquean al resto.

## Estimación

- Primer drain: 30–90 min (307 docs ÷ 10 paralelos × ~30–120 s/doc).
- Segunda pasada (si hay outliers OCR): 10–30 min adicionales.
- **Total < 2 h** hasta cobertura semántica ≥ 99 %.

## Resultado esperado

- Cobertura del corpus pasa de 82 % (~464k/565k) a ~99 % (~560k/565k).
- `rag_hybrid_search` deja de tener huecos en attachments y emails antiguos.
- Cola en `done`, lista para futuros backfills.

