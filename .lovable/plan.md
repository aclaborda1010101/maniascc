

## Plan: Generador de Documentos + AVA con análisis geográfico y exportación PDF

### Resumen
Tres cambios: (1) Reemplazar "Notificaciones" en el menú principal por "Generador de Documentos" con ruta `/generador`, extrayendo FORGE de Oportunidades a una página independiente. (2) Mejorar AVA para que haga análisis de localización con POIs del entorno (Google Maps/Nominatim). (3) Añadir a AVA la capacidad de generar PDFs profesionales desde sus respuestas.

---

### 1. Menú lateral: Notificaciones → Generador de Documentos

**`src/components/AppSidebar.tsx`**
- Cambiar en `mainItems`: `{ title: "Generador de Documentos", url: "/generador", icon: Hammer }` en lugar de Notificaciones
- Las notificaciones siguen accesibles desde el icono de campana en el header (ya existe en `AppLayout`)

**`src/pages/GeneradorDocumentos.tsx`** (nuevo)
- Página standalone que reutiliza la lógica de `ProyectoForge` pero sin requerir `proyectoId`
- Muestra las 6 cards de FORGE_MODES, campo de contexto, botón generar, resultado con markdown renderizado y exportar PDF
- El `proyectoId` pasa a ser opcional (selector de oportunidad existente, o vacío)

**`src/App.tsx`**
- Añadir ruta `/generador` → `GeneradorDocumentos`
- Redirect `/notificaciones` → `/dashboard`

**`src/pages/ProyectoDetail.tsx`**
- Eliminar el tab "FORGE" de las pestañas de oportunidad (la funcionalidad vive ahora en `/generador`)

---

### 2. AVA con análisis geográfico de POIs

**`supabase/functions/ava-orchestrator/index.ts`**
- Añadir nueva tool `nearby_search` al array TOOLS:
  - Parámetros: `lat`, `lon`, `radius_m`, `query` (ej: "McDonald's", "gasolinera", "centro comercial")
  - Implementación: llama a la API Nominatim/Overpass (OSM) para buscar POIs cercanos (gratuita, sin API key)
- Actualizar el SYSTEM_PROMPT para indicar a AVA que cuando le pregunten sobre una ubicación comercial, debe usar `nearby_search` para analizar McDonald's, gasolineras, competencia, transporte, etc.

---

### 3. AVA genera PDF profesional desde respuestas

**`src/pages/AsistenteIA.tsx`**
- Añadir botón "Exportar PDF" en cada mensaje de tipo assistant
- Al pulsar, genera un HTML profesional con la función `markdownToHtml` (reutilizada de ProyectoForge) y abre diálogo de impresión/PDF
- Diseño limpio: header con "Informe AVA", fecha, branding MANIAS CC, contenido formateado

---

### Archivos afectados

| Archivo | Acción |
|---|---|
| `src/components/AppSidebar.tsx` | Notificaciones → Generador de Documentos |
| `src/pages/GeneradorDocumentos.tsx` | Nueva página FORGE standalone |
| `src/App.tsx` | Ruta `/generador`, redirect `/notificaciones` |
| `src/pages/ProyectoDetail.tsx` | Quitar tab FORGE |
| `supabase/functions/ava-orchestrator/index.ts` | Tool `nearby_search` con Overpass/Nominatim |
| `src/pages/AsistenteIA.tsx` | Botón exportar PDF en mensajes assistant |

### Nota técnica
- La búsqueda de POIs usa Overpass API (OpenStreetMap), gratuita y sin clave API
- El PDF se genera mediante HTML + `window.print()` (mismo método actual de FORGE)
- `ProyectoForge` se mantiene como componente por si se reutiliza, pero el tab se elimina de ProyectoDetail

