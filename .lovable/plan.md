

## Plan: Completar indexación RAG + Embeddings reales con Google

### Diagnóstico actual

1. **53 documentos sin procesar**: La mayoría son PDFs y PPTXs. Los fallos se deben a:
   - **Timeouts**: PPTXs de 13-22MB exceden el tiempo de la edge function (archivos grandes en base64 saturan Gemini)
   - **Archivos huérfanos**: ~10 registros en DB sin archivo real en Storage

2. **No hay embeddings reales**: La tabla `document_embeddings` tiene 0 filas. El sistema actual solo hace chunking de texto + búsqueda FTS (full-text search de PostgreSQL). No se usa Google Embedding 2 ni ningún modelo de embeddings.

3. **AVA sí está conectada al RAG**: El orchestrator tiene la herramienta `rag_search` que llama a `rag-proxy-v4`, que busca en `document_chunks` por FTS. Funciona, pero solo con los 39 docs ya procesados.

---

### Lo que se hará

#### Paso 1 — Procesar los 53 documentos pendientes
- Script batch que llame a `rag-ingest` para cada documento pendiente
- Para archivos >10MB (PPTXs grandes): se intentará igualmente pero con timeout extendido
- Los archivos huérfanos (sin fichero en Storage) se marcarán como procesados con nota de error para no bloquear

#### Paso 2 — Mejorar `rag-ingest` para robustez
- Añadir `max_tokens: 16000` explícito en la llamada a Gemini (ya existe)
- Añadir manejo de archivos grandes: si el base64 supera 20MB, dividir o usar metadata fallback
- Mejorar logging para diagnosticar fallos

#### Paso 3 — (Opcional futuro) Google Embedding 2 real
Actualmente el sistema funciona con FTS de PostgreSQL, que es funcional y rápido. Implementar embeddings vectoriales reales con Google Embedding API requeriría:
- Llamar a la API de embeddings para cada chunk (no disponible vía Lovable AI Gateway actualmente — el gateway solo soporta chat completions, no embedding endpoints)
- Almacenar vectores en `document_embeddings`
- Usar `pgvector` para búsqueda por similitud coseno

**Nota**: El Lovable AI Gateway (`ai.gateway.lovable.dev`) solo expone `/v1/chat/completions`, no `/v1/embeddings`. Por tanto, embeddings vectoriales reales no son posibles sin una API key de Google directa. El sistema FTS actual + Gemini para extracción es la mejor opción disponible.

---

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/rag-ingest/index.ts` | Mejorar manejo de archivos grandes y logging |
| Script temporal (exec) | Batch re-indexación de los 53 documentos pendientes |

### Resumen
- Se procesarán los 53 docs restantes con el pipeline multimodal Gemini existente
- AVA ya consume el RAG correctamente via `rag_search` → `rag-proxy-v4`
- Los embeddings vectoriales reales no son viables con el gateway actual; el FTS funciona bien como alternativa

