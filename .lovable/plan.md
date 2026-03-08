

## Plan: Implementar Sistema RAG (Retrieval-Augmented Generation)

El proyecto ya tiene un stub en `ragService.ts` y una edge function `rag-proxy` que no existe. Vamos a construir un RAG completo que permita hacer preguntas sobre los documentos del proyecto y obtener respuestas fundamentadas con citas.

### Arquitectura

```text
Usuario pregunta
       │
       ▼
  [rag-proxy edge function]
       │
       ├─ 1. Busca chunks relevantes en tabla `document_chunks`
       │     (búsqueda por texto full-text + filtros por proyecto)
       │
       ├─ 2. Envía pregunta + chunks al AI Gateway (Gemini)
       │     con instrucciones de citar fuentes
       │
       └─ 3. Devuelve respuesta + citas + confianza
```

### Cambios

**1. Migración SQL** — Crear tabla `document_chunks` + índice full-text
- `document_chunks(id, documento_id, proyecto_id, contenido, metadata, chunk_index, created_at)`
- Índice GIN con `to_tsvector('spanish', contenido)` para búsqueda full-text en español
- RLS: lectura para autenticados, inserción para gestores/admins

**2. Edge function `rag-ingest`** — Procesa documentos y genera chunks
- Recibe `documento_id`, descarga el archivo de Storage
- Extrae texto (para PDF/text), divide en chunks de ~500 tokens con overlap
- Inserta chunks en `document_chunks`
- Se invoca automáticamente al subir un documento

**3. Edge function `rag-proxy`** — Consulta RAG (ya referenciada en `ragService.ts`)
- Recibe `{ question, filters: { proyecto_id? } }`
- Busca top 10 chunks relevantes usando `ts_rank` + `plainto_tsquery('spanish', question)`
- Construye prompt con contexto de los chunks
- Llama al AI Gateway (Gemini Flash) pidiendo respuesta con citas
- Devuelve `{ answer, citations, confidence }`

**4. Actualizar `ragService.ts`** — Añadir función `ingestDocument()` que llama a `rag-ingest`

**5. UI: Pestaña "Base de Conocimiento" en ProyectoDetail**
- Campo de pregunta con respuesta streaming
- Lista de documentos indexados del proyecto
- Botón para reindexar documentos
- Las respuestas muestran citas con links a los documentos originales

**6. Integrar ingesta automática** — En el tab Documentos de ProyectoDetail, tras subir un archivo, llamar a `rag-ingest` para indexarlo

### Detalle técnico

- Full-text search en español (no requiere extensiones extra como pgvector)
- Chunks de ~500 tokens con 50 tokens de overlap para mantener contexto
- El modelo recibe los chunks como contexto y debe citar `[doc_nombre, chunk_index]`
- Filtro por `proyecto_id` para que cada proyecto tenga su propia base de conocimiento
- Soporte inicial para archivos de texto plano; PDF se extrae con lógica básica en Deno

