

## Plan: Migrar activos reales + RAG multimodal con Google Embeddings

### Resumen ejecutivo
Tres cambios principales:
1. **Eliminar los 2 activos demo** de la tabla `locales` y **crear 9 activos reales** correspondientes a los 9 proyectos del ZIP
2. **Reescribir el sistema de ingest RAG** para usar la API de Google (Gemini) como extractor de contenido multimodal, permitiendo procesar PDF, DOCX, PPTX, XLSX, imágenes, y archivos binarios como DWG/MSG/EML
3. **Ejecutar el re-indexado** de los 92 documentos subidos

---

### Paso 1 — Limpiar activos demo y crear los 9 reales

**Datos**: Eliminar de `locales` los registros "Local Centro Gran Vía" y "Local Diagonal". Crear 9 nuevos registros en `locales`, uno por proyecto, vinculándolos por nombre/contexto a los proyectos existentes en `proyectos`.

Activos a crear:
- La Milla Arganda
- C.C. Rivas  
- C.C. Aluche
- Atalayuela Lidl
- Acciona Parcela 3.3
- C.C. Eboli
- Ozone
- Los Olivos
- Pinto

Se usará un script que inserte directamente en `locales` con datos básicos (nombre, ciudad, dirección estimada del proyecto).

---

### Paso 2 — Reescribir `rag-ingest` con Google Gemini como extractor multimodal

**Problema actual**: El ingest solo extrae texto de archivos text/csv/json y hace una extracción rudimentaria de PDFs. DOCX, PPTX, XLSX, imágenes y archivos binarios (DWG, MSG, EML) se descartan.

**Solución**: Usar la API de Lovable AI Gateway (Gemini) para enviar el archivo como base64 y pedirle que extraiga todo el contenido textual. Gemini puede procesar:
- PDFs (con OCR de imágenes embebidas)
- DOCX, PPTX, XLSX (como binarios interpretables)
- Imágenes JPG/PNG (OCR + descripción)
- MSG/EML (puede interpretar la estructura de email)
- DWG: se intentará, pero si Gemini no puede interpretarlo, se generará una descripción de metadatos

**Cambios en `supabase/functions/rag-ingest/index.ts`**:
- Descargar el archivo de Storage como antes
- Convertir a base64
- Enviar a `https://ai.gateway.lovable.dev/v1/chat/completions` con el modelo `google/gemini-2.5-flash` usando el contenido como parte multimodal (inline_data con mime_type)
- El prompt pedirá: "Extrae TODO el contenido textual de este documento de forma estructurada. Incluye tablas, datos, cifras, nombres, fechas, y cualquier información relevante."
- El texto resultante se chunkeará y almacenará como antes en `document_chunks`
- Para archivos de texto plano (TXT, CSV, JSON), se mantiene la lectura directa sin IA

**Archivos binarios no soportados por Gemini** (como .dwg): se enviará igualmente y si falla, se creará un chunk con metadatos del archivo (nombre, tipo, tamaño, proyecto).

---

### Paso 3 — Re-indexar los 92 documentos

Crear un script o edge function batch que recorra todos los `documentos_proyecto` con `procesado_ia = false` y llame al nuevo `rag-ingest` para cada uno. Se ejecutará como un proceso secuencial con delays para evitar rate limits.

---

### Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| `supabase/functions/rag-ingest/index.ts` | Reescritura completa: extracción multimodal vía Gemini |
| Script de datos (ejecutado via exec) | Eliminar demos de `locales`, insertar 9 activos reales |
| Script de re-indexado (ejecutado via exec) | Llamar rag-ingest para los 92 documentos |

### Detalle técnico del ingest multimodal

```text
Flujo actual:
  archivo → download → text/pdf extraction manual → chunks → DB

Flujo nuevo:
  archivo → download → base64 → Gemini API (multimodal) → texto extraído → chunks → DB
  (excepto text/csv/json → lectura directa)
```

La API de Gemini se llamará con:
- `model: "google/gemini-2.5-flash"` (rápido y económico para extracción)
- El archivo como `inline_data` con su mime_type real
- Un system prompt optimizado para extracción documental en español

