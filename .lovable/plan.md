

# Optimización mobile (versión 390px)

Limpieza global de la interfaz móvil siguiendo dos principios estrictos del usuario: **prohibido scroll horizontal** (sustituido por selectores) y **botones primarios a ancho completo** en móvil. Más unificación de color y arreglo de varios puntos visuales rotos.

## 1. Dashboard (`/dashboard`)

- CTAs "Nueva oportunidad" y "Nuevo operador": en móvil pasan a `h-11`, ancho completo apilados (mismo tamaño que los buscadores del resto de la app).
- Bloques **Últimos Matches** y **Actividad Reciente**: revisar overflow — añadir `min-w-0` a los hijos flex y `truncate` real en los textos largos para que las cards no rompan los márgenes.
- **Header móvil superior** (la barra con "AVA", campanita y avatar): se oculta en móvil. La identidad y el menú ya están en el `BottomNav`, por lo que esta barra es redundante. Solo se mantiene en desktop.

## 2. Oportunidades (`/oportunidades`)

- Chips horizontales (Todas / Activas / Negociación / En pausa / Cerradas): se sustituye en móvil por un `<Select>` único. En desktop se mantienen los chips actuales.
- Botón "Nueva oportunidad": ya está full width en móvil — verificar altura coherente (`h-11`).

## 3. Detalle de oportunidad (`/oportunidades/:id`)

- `TabsList` con scroll lateral (Resumen / Activos / Ops / Match / Docs / RAG / Insights / Negoc.): se sustituye en móvil por un `<Select>` que cambia la pestaña activa. En desktop se mantiene como está.

## 4. Activos (`/activos`)

- Las "fichas" (cards de la lista mobile) están demasiado pegadas: aumentar `space-y-2` → `space-y-3` y añadir un poco de `padding` interno (`p-3` → `p-4`).
- Botón "Nuevo Activo": ya full width en móvil — verificar altura `h-11`.

### Detalle de activo (`/activos/:id`)

- En la card "AVA propone", los botones **Ver matches** y **Generar dossier** pasan a ancho completo apilados en móvil (en desktop quedan en línea).

## 5. Operadores (`/operadores`)

- Cards de operadores muy pegadas: mismo ajuste que activos — `space-y-3` y `p-4`.
- Botón "Nuevo Operador": ya full width en móvil.

### Detalle de operador (`/operadores/:id`)

- `TabsList` (Información General / Perfil IA / Sub-operadores) con scroll horizontal → en móvil se convierte en `<Select>`. Desktop conserva tabs.

## 6. Matching (`/matching/:localId`)

- Cola inferior con scroll lateral (Sephora, Zara, etc.) → en móvil se sustituye por una **lista vertical compacta** (cards apiladas en `flex-col gap-2`). Desktop conserva el scroll horizontal actual.
- Badge del sector debajo del nombre del operador: el círculo blanco con texto blanco se corrige cambiando `Badge variant="secondary"` por estilo con contraste explícito (texto oscuro o accent sobre fondo claro/translúcido).

## 7. Patrones (`/patrones`)

- Botones "Actualizar" / "Cargar patrones" y "Consultar AVA": en móvil pasan a ancho completo y apilados en filas separadas. Desktop mantiene fila horizontal.

## 8. Conocimiento (`/conocimiento`)

- Sección **Mantenimiento masivo**: los botones (Encolar pendientes, Clasificar lote, Indexar lote, Generar embeddings, Refrescar stats) actualmente usan `flex-wrap`. En móvil → ancho completo, uno por fila.
- **Unificación de color**: todos los botones primarios de esta sección adoptan la paleta degradada iridiscente (`gradient-iridescent`) o la accent unificada — eliminamos la mezcla actual de `default` / `outline` / `ghost` con tonos diferentes. Los secundarios (refrescar) quedan en `outline` neutro.

## 9. Validación dossier (`/validacion-dossier`)

- Botón "Validar Dossier": en móvil ancho completo.

## 10. Optimización mix (`/tenant-mix`)

- Botón "Generar Planes A/B/C": en móvil ancho completo.

## 11. Negociación IA (`/negociacion-ia`)

- Botón "Generar Briefing": en móvil ancho completo.

## Lo que NO se toca

- Generador de documentos (ya está bien según el usuario).
- Documentos.
- Contactos (sin contenido aún).
- Formularios dentro de diálogos.
- Versión desktop de cualquiera de las páginas anteriores.
- Lógica de negocio, fetches o estado.

## Detalles técnicos

- Patrón de "tabs → select en móvil": condicional con `useIsMobile()`. Se renderiza `<Select>` con las mismas opciones de los `TabsTrigger`, que dispara el `onValueChange` cambiando el `value` del `<Tabs>` controlado. El componente `<Tabs>` pasa de no-controlado (`defaultValue`) a controlado (`value` + `onValueChange`) en estas páginas.
- Patrón de botones full-width en móvil: clases `w-full sm:w-auto h-11` aplicadas de forma consistente. Para grupos de botones, contenedor `flex flex-col sm:flex-row gap-2` con `w-full sm:flex-1` o `sm:w-auto` según el caso.
- Espaciado de cards mobile: `space-y-3` (en lugar de `space-y-2`) y `p-4` interno.
- Header móvil: en `AppLayout.tsx`, la sección `<header className="md:hidden ...">` se elimina/oculta. El padding superior del `<main>` se ajusta para compensar (`pt-4` en móvil) ya que el `BottomNav` ya está fijo abajo.
- Badge sector en Matching: cambiar a `<span>` con fondo `bg-accent/15` y texto `text-accent` (no `Badge variant="secondary"`) para asegurar contraste sobre cualquier fondo.
- Color unificado en `/conocimiento`: se usan dos variantes — primaria iridiscente (`gradient-iridescent text-white`) para acciones que ejecutan trabajo, y `outline` neutro para refrescar.

## Archivos a modificar

- `src/components/AppLayout.tsx` — ocultar header móvil.
- `src/pages/Dashboard.tsx` — CTAs y arreglo de overflow en últimas listas.
- `src/pages/Proyectos.tsx` — chips → select en móvil.
- `src/pages/ProyectoDetail.tsx` — tabs → select en móvil.
- `src/pages/Locales.tsx` — espaciado cards móvil.
- `src/pages/LocalDetail.tsx` — botones AVA propone full-width móvil.
- `src/pages/Operadores.tsx` — espaciado cards móvil.
- `src/pages/OperadorDetail.tsx` — tabs → select en móvil.
- `src/pages/Matching.tsx` — cola vertical en móvil + arreglo badge sector.
- `src/pages/Patrones.tsx` — botones full-width móvil.
- `src/pages/Conocimiento.tsx` — botones mantenimiento full-width móvil + unificación color.
- `src/pages/DossierValidation.tsx` — botón principal full-width móvil.
- `src/pages/TenantMixOptimizer.tsx` — botón principal full-width móvil.
- `src/pages/NegotiationBriefing.tsx` — botón principal full-width móvil.

