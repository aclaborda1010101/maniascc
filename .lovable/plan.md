## Auditoría — de dónde salen los 107 € de Lovable Cloud

He medido los cinco sospechosos contra tu base de datos real. Resultado: **uno solo concentra la mayor parte del coste**, y dos son ruido.

---

### 🔴 Causa principal: la tabla `document_chunks` está fuera de control

| Métrica | Valor |
|---|---|
| Filas (chunks) | **565.413** |
| Tamaño total tabla + índices | **7,5 GB** |
| Índice vectorial HNSW principal | **2,5 GB** |
| Segundo índice (HNSW/IVF) | **576 MB** |
| Texto bruto almacenado | 527 MB |
| Tamaño total de la base de datos | dominada por esta tabla |

Esto obliga a la instancia de Cloud a mantener **mucha RAM** (los índices HNSW se cargan en memoria para buscar rápido). Es casi seguro el motivo por el que la instancia está en un tier alto: no es que la subieras tú, es que el RAG no cabe en la pequeña.

#### Y además: documentos duplicados ingestados N veces

| Documento | Copias | Chunks acumulados |
|---|---:|---:|
| `Producto_HG.xlsx` | **7** | 15.257 |
| `RV_ Acqua Sapone.eml` | 2 | 8.683 |
| `Atlas Tape EoApr'23.xlsx` | 2 | 3.830 |
| `RE: [EXTERNAL] Re: Fuencarral 45` | **50** | 653 |
| `¡Glovo confirmado!` | **466** | 466 |
| `Re:` (asunto vacío) | **88** | 390 |
| …docenas más | — | — |

Los emails se están reingestando una y otra vez (probablemente el sync los trae con asuntos repetidos y no hay deduplicación por `message_id` / hash).

---

### 🟡 Causa secundaria: tabla `documentos_proyecto` (97 MB)

Guarda el **texto extraído completo** de cada documento, además de chunkearlo. Es duplicación de información: el texto vive dos veces (una en `documentos_proyecto.contenido_extraido`, otra troceada en `document_chunks.contenido`).

### 🟡 `cron.job_run_details` — 123 MB

721 ejecuciones en las últimas 24h (cron de email cada 2 min). El cron en sí está bien diseñado (no llama a la función si la cola está vacía), pero el **historial de runs no se purga** y crece sin parar.

---

### ✅ Sospechosos descartados

| Sospechoso | Veredicto | Datos |
|---|---|---|
| **Storage de adjuntos** (Plaud, Forge, contratos) | **No es el problema** | Total: 131 MB en los 3 buckets (contratos 103 MB, ava_attachments 17 MB, generados 11 MB). Coste despreciable. |
| **Sync email/WhatsApp en bucle** | **No está descontrolado** | El cron cada 2 min sólo dispara HTTP si hay mensajes en `pgmq`. Sin embargo **sí está alimentando los duplicados** del RAG. |
| **OneDrive sync** | No hay rastro de ejecuciones recientes | — |
| **rag-batch-orchestrator reprocesando** | Cola `rag_reprocess_queue` sólo pesa 440 kB | No está en bucle |
| **Uso de IA (Gemini, embeddings)** | **Muy bajo** | Sólo 20 llamadas en 14 días, ~180k tokens input totales. Coste IA real < 1 € en el periodo |

---

### 📊 Resumen del gasto probable

```text
~80%  Compute de la instancia DB grande (forzada por 7,5 GB de chunks + índices HNSW en RAM)
~10%  Egress de queries vectoriales sobre esos índices
~ 5%  Logs cron + tabla documentos_proyecto inflada
~ 5%  Resto (storage, edge functions, realtime)
```

El IA y el storage **no son** el problema. El RAG sí.

---

## Plan de acción recomendado (3 niveles, de menos a más radical)

### Nivel 1 — Limpieza inmediata (gana 60-70% de espacio sin perder valor)

1. **Deduplicar `documentos_proyecto`** por (`nombre`, `hash_contenido` o `tamano_bytes`) — borrar copias, cascadear a `document_chunks`. Los 7 `Producto_HG.xlsx` solos liberan ~15k chunks (≈200 MB).
2. **Borrar emails-basura ingestados** ("Re:", "¡Glovo confirmado!", confirmaciones automáticas). Filtro por asuntos genéricos / dominios noreply.
3. **Purgar `cron.job_run_details`** y crear un cron diario que mantenga sólo los últimos 7 días.
4. **Vacuum + reindex** de `document_chunks` tras los borrados (libera espacio físico real, no sólo lógico).

Estimación: pasar de 7,5 GB → ~2-3 GB.

### Nivel 2 — Arquitectura del RAG (gana otro 40% y reduce RAM)

5. **Filtro de ingesta**: bloquear que se indexen emails con `body < 500 chars`, asuntos en lista negra, o adjuntos vacíos. Deduplicar por `message_id` antes de chunkear.
6. **Quitar `contenido_extraido` de `documentos_proyecto`** una vez chunkeado (o moverlo a Storage en frío). Ahorra ~97 MB y, sobre todo, evita el doble guardado futuro.
7. **Cambiar embeddings `vector(768)` → `halfvec(768)`** en `document_chunks`. Mismo recall, **mitad de RAM** en el índice HNSW (2,5 GB → ~1,2 GB). Es el cambio con mejor ratio coste/beneficio.

### Nivel 3 — Bajar de instancia (la palanca real sobre la factura)

8. Tras Nivel 1+2, con la DB en ~1,5 GB y los índices en ~1,2 GB, **bajar el tier de la instancia Cloud** desde **Backend → Lovable Cloud → Advanced settings**. Aquí es donde se nota en la factura.

---

## Qué necesito de ti para ejecutar

Antes de tocar nada destructivo:

- ¿Apruebas borrar los duplicados de `documentos_proyecto` (manteniendo la copia más antigua de cada nombre)?
- ¿Quieres que defina la lista negra de asuntos de email a purgar, o me das tú criterios?
- ¿Avanzo con el cambio a `halfvec` (requiere migración + re-creación del índice HNSW, ~5-10 min con la base bloqueada para escrituras)?

Cuando confirmes, abro build mode y lo ejecuto por fases con migraciones reversibles.