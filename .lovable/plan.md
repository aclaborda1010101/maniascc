

# Plan: Reestructuración sección INTELIGENCIA + UX no-técnica

## Resumen
Reorganizar la navegación, simplificar formularios eliminando JSON visible, crear Asistente IA (chat) y Administración (panel admin con auditoría), y actualizar especialistas Expert Forge.

---

## Cambios por archivo

### 1. Sidebar (`src/components/AppSidebar.tsx`)
- Sección **Inteligencia**: Localización, Validación Dossier, Tenant Mix, Negociación IA, **Asistente IA** (icono `Bot`, ruta `/asistente`)
- Eliminar "Búsqueda IA" y "Auditoría IA" de sus secciones actuales
- Nueva sección **Admin** al fondo (antes del footer): solo "Administración" (icono `Settings`, ruta `/admin`)

### 2. Localización (`src/pages/LocationAnalysis.tsx`)
- Campo principal: **Dirección** (texto libre) con geocodificación Nominatim (`fetch https://nominatim.openstreetmap.org/search?q=...&format=json`)
- Sección colapsable `<Collapsible>` "Coordenadas avanzadas (opcional)" con Lat/Lon
- Al escribir dirección y pulsar Analizar, geocodifica primero, luego llama al edge function con las coordenadas resultantes
- Mantener Radio, Tipo de centro, Presupuesto
- Validación: si no hay dirección ni coordenadas, mostrar error

### 3. Validación Dossier (`src/pages/DossierValidation.tsx`)
- Reemplazar `<Textarea>` JSON por 5 inputs numéricos: Rentabilidad (%), Tasa ocupación (%), Precio renta m² (€), Tráfico diario, CAPEX m² (€)
- Botón "+ Añadir métrica" que agrega pares clave-valor dinámicos (array de `{key, value}`)
- Internamente construye `metricas_declaradas` JSON antes de enviar
- Mantener Tipo activo, Ubicación, CP, Propietario

### 4. Tenant Mix (`src/pages/TenantMixOptimizer.tsx`)
- Eliminar `<Textarea>` JSON
- Sección "Locales disponibles" con botón "+ Añadir local"
- Cada local: Superficie m² (input), Planta (select), Estado (select), Operador actual (input opcional)
- Lista visual de locales añadidos con botón eliminar
- Internamente construye array JSON

### 5. Negociación IA (`src/pages/NegotiationBriefing.tsx`)
- Reemplazar inputs de Nombre/Empresa/Cargo por **Combobox** que busca en tabla `contactos`
- Al seleccionar contacto, autorellenar empresa y cargo
- Opción "Crear nuevo" inline si no existe
- **Eliminar** panel Expert Forge de abajo (líneas 203-241)
- Mantener Contexto del deal, Notas previas, Historial

### 6. Asistente IA (NUEVA: `src/pages/AsistenteIA.tsx`, ruta `/asistente`)
- Interfaz chat conversacional full-height
- Historial de mensajes en `localStorage`
- Usa `queryExpertForge(question)` SIN specialist_id (MoE Router decide)
- Cada respuesta muestra: texto (markdown con `react-markdown`), fuentes, especialista usado, confianza, latencia
- Input con Enter para enviar, loading state
- Botón "Nueva conversación" para limpiar

### 7. Administración (NUEVA: `src/pages/Admin.tsx`, ruta `/admin`)
- 3 pestañas con `<Tabs>`:
  - **Conexión Expert Forge**: indicador verde/rojo, URL gateway, Project ID, botón "Probar conexión" que llama `queryExpertForge("ping")`, lista de especialistas de `EXPERT_SPECIALISTS`
  - **Auditoría IA**: mover contenido actual de `Auditoria.tsx` (KPIs + tabla), añadir filtros por fecha y función
  - **Configuración**: mapeo de especialistas, info de integración

### 8. Expert Forge (`src/services/expertForge.ts`)
- Actualizar `EXPERT_SPECIALISTS`:
```typescript
export const EXPERT_SPECIALISTS = {
  NEGOCIACION: "442a4ad6",
  AUDITORIA: "6ace2754",
  MATCHING: "6a2cfd5e",
  ATLAS: "442a4ad6",
  FORGE7: "0de742b5",
  SCRAPING: "24d75154",
  COORDINADOR: "59d5e344",
} as const;
```

### 9. Rutas (`src/App.tsx`)
- Añadir lazy imports: `AsistenteIA`, `Admin`
- Añadir rutas: `/asistente` → `AsistenteIA`, `/admin` → `Admin`
- Mantener `/busqueda` y `/auditoria` como redirects a `/asistente` y `/admin` respectivamente (retrocompatibilidad)

---

## Dependencias
- `react-markdown` ya disponible o se añade para renderizado markdown en Asistente IA
- Nominatim API (gratuita, sin API key) para geocodificación

## Archivos afectados
- **Crear**: `src/pages/AsistenteIA.tsx`, `src/pages/Admin.tsx`
- **Editar**: `AppSidebar.tsx`, `LocationAnalysis.tsx`, `DossierValidation.tsx`, `TenantMixOptimizer.tsx`, `NegotiationBriefing.tsx`, `expertForge.ts`, `App.tsx`

## Lo que NO cambia
- Edge functions (no se tocan)
- Payloads internos (misma estructura JSON)
- Tema oscuro (se mantiene)
- Búsqueda global (se redirige desde `/busqueda`)

