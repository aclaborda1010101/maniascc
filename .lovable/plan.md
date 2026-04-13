

## Plan: PDF profesional con portada, índice y contenido via html2pdf.app

### Situación actual
Los 3 puntos de generación de PDF (AsistenteIA, GeneradorDocumentos, ProyectoForge) usan `window.open()` + `window.print()`. Esto produce PDFs sin portada, sin índice, y con formato básico. El contenido markdown se convierte a HTML inline con regex simples.

### Arquitectura propuesta

Crear una **Edge Function `generate-pdf`** que reciba el HTML completo y llame a la API de html2pdf.app para generar un PDF real (no dependiente del navegador). Esto centraliza la generación y permite portada + índice + paginación.

### Cambios

#### 1. Guardar el API key de html2pdf.app como secret
- Usar la herramienta `add_secret` para almacenar `HTML2PDF_API_KEY`

#### 2. Nueva Edge Function `supabase/functions/generate-pdf/index.ts`
- Recibe `{ title, content_markdown, mode_label?, date? }`
- Convierte el markdown a HTML estructurado con:
  - **Página 1 (Portada)**: título centrado, fecha, logo/branding "F&G Real Estate", badge del tipo de documento
  - **Página 2 (Índice)**: extrae los `## headings` del markdown y genera una tabla de contenidos con enlaces internos
  - **Páginas 3+ (Contenido)**: el informe completo con headers, tablas, listas, tipografía profesional, footer con número de página
- Llama a `https://api.html2pdf.app/v1/generate` con el HTML y opciones (A4, márgenes 2cm, header/footer)
- Devuelve el PDF como blob binario

#### 3. Nuevo servicio compartido `src/services/pdfService.ts`
- `export async function generateProfessionalPdf(title, markdownContent, modeLabel?): Promise<Blob>`
- Llama a la Edge Function `generate-pdf`
- Descarga el blob y lo ofrece al usuario como archivo `.pdf`

#### 4. Actualizar los 3 consumidores
- **`src/pages/AsistenteIA.tsx`**: reemplazar `exportMessageToPdf()` por llamada a `generateProfessionalPdf()`
- **`src/pages/GeneradorDocumentos.tsx`**: reemplazar `exportToPdf()` por `generateProfessionalPdf()`
- **`src/components/proyecto/ProyectoForge.tsx`**: reemplazar `exportToPdf()` por `generateProfessionalPdf()`
- Eliminar las funciones `markdownToHtml` y `exportToPdf` duplicadas de cada archivo

### Estructura del PDF generado

```text
┌─────────────────────┐
│                     │
│   F&G REAL ESTATE   │
│                     │
│   ═══════════════   │
│                     │
│   MASTERPLAN        │
│   ESTRATÉGICO       │
│   LA MILLA DE       │
│   ARGANDA           │
│                     │
│   13 abril 2026     │
│   Plan Estratégico  │
│                     │
│        [Pág 1]      │
└─────────────────────┘

┌─────────────────────┐
│  ÍNDICE             │
│  ─────              │
│  1. Resumen Ejec. 3 │
│  2. Análisis Comp.  4│
│  3. Fase 1 ........ 6│
│  4. Fase 2 ........ 8│
│  5. Fase 3 ........ 9│
│  6. Métricas ...... 11│
│                     │
│        [Pág 2]      │
└─────────────────────┘

┌─────────────────────┐
│  1. Resumen Ejecut. │
│  ───────────────    │
│  El parque comercial│
│  "La Milla de..."  │
│  ...                │
│                     │
│  ── F&G ── Pág 3 ──│
└─────────────────────┘
```

### Diseño visual
- Portada con fondo blanco limpio, título en tipografía grande, línea decorativa en color corporativo (#6366f1)
- Índice generado automáticamente desde los headings `##` del markdown
- Contenido con tipografía Inter/Segoe UI, tablas con bordes sutiles, listas con bullets limpios
- Footer en todas las páginas de contenido con "F&G Real Estate — Generado por AVA/FORGE" y número de página
- Saltos de página automáticos antes de cada sección principal (`##`)

### Archivos a crear/modificar
- **Crear**: `supabase/functions/generate-pdf/index.ts`
- **Crear**: `src/services/pdfService.ts`
- **Modificar**: `src/pages/AsistenteIA.tsx` — usar nuevo servicio
- **Modificar**: `src/pages/GeneradorDocumentos.tsx` — usar nuevo servicio
- **Modificar**: `src/components/proyecto/ProyectoForge.tsx` — usar nuevo servicio

