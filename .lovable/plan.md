

# Plan: Rediseño visual completo de AVA basado en `AVA Redesign.html`

## Cómo lo abordaré

### Fase 1 — Extraer el sistema de diseño del HTML (primera cosa al entrar en modo default)

1. Descomprimir `AVA.zip` en `/tmp/ava_styles/` y abrir `AVA Redesign.html`.
2. Extraer y catalogar:
   - **Paleta**: colores primarios, acento, fondo, superficie, borde, estados (success/warning/danger/info), variantes hover/active.
   - **Tipografía**: familia(s), pesos, escalas (h1–h4, body, caption), interlineado, tracking.
   - **Tokens**: radios, sombras, espaciados, transiciones, gradientes si los hay.
   - **Componentes de referencia**: cómo se ven en el HTML el sidebar, header, cards, tablas, botones, inputs, badges, dialog/sheet, KPIs, listas.
3. Si el HTML define explícitamente light + dark, uso ambos. Si solo trae uno, derivo el opuesto manteniendo contraste WCAG AA.
4. Te enseño una captura del HTML original junto a una captura del Dashboard actual antes de tocar nada, para validar que vamos al sitio correcto.

### Fase 2 — Aplicar tokens globales (un único commit, riesgo bajo)

5. Reescribir `src/index.css` con las variables HSL nuevas (`--background`, `--foreground`, `--primary`, `--accent`, `--card`, `--border`, `--sidebar-*`, `--chart-*`) en `:root` y `.dark`.
6. Actualizar `tailwind.config.ts`:
   - `fontFamily.sans` con la nueva familia (importada en `index.css` desde Google Fonts si aplica).
   - Añadir `boxShadow`, `borderRadius` y `keyframes` que use el HTML.
7. Mantener intactos los nombres de tokens (`bg-card`, `text-foreground`, etc.) para no romper el resto de componentes.
8. Refrescar la sección `.ava-report` y `.prose` con la nueva tipografía y paleta para que el chat de AVA siga coherente.

### Fase 3 — Componentes shadcn alineados al diseño

9. Ajustar variantes en:
   - `Button` (variantes `default`, `outline`, `ghost`, `destructive`, `link`) — radios, sombras, padding.
   - `Card` (sombra suave, radio, header/footer).
   - `Input`, `Select`, `Textarea` (altura, radio, focus ring).
   - `Badge`, `Tabs`, `Dialog`, `Sheet`, `Dropdown` — radios y colores.
   - `Sidebar` (`SidebarProvider`, `SidebarMenuButton`) con activo/hover según el HTML.

### Fase 4 — Layouts de páginas clave

10. `AppLayout` (header + sidebar) — ajustar altura, separadores, avatar, buscador.
11. `AppSidebar` — agrupaciones, iconos, estados activos, footer (theme + signout) según el HTML.
12. Páginas que más impactan visualmente, en este orden:
    - `Dashboard` (KPIs, charts, recientes)
    - `AsistenteIA` + `FloatingChat` (burbujas, attachments, controles voz)
    - `Proyectos` y `ProyectoDetail` (tabs)
    - `Contactos`, `Operadores`, `Locales` (listados/tablas)
    - `Documentos`, `Conocimiento` (RAG)
    - `Patrones`, `Consumo`, `Auditoria`, `Admin`, `Ajustes`
    - `Login` (alinear con marca)
13. Revisar `MatchCard`, `NegotiatorCard`, `ScoreGauge`, `TrafficLight`, `StatusBadge`, `EmptyState`, `NotificationCenter` para que respeten los nuevos tokens.

### Fase 5 — Modo oscuro y responsive

14. Validar `.dark` en cada página tras la migración (toggle ya existe en sidebar).
15. Probar mobile (375 px), tablet (768 px) y desktop (1280 px). Ajustar header colapsable, sidebar off-canvas y `FloatingChat`.

### Fase 6 — QA visual

16. Capturas de antes/después de Dashboard, Asistente, Proyectos, Contactos, Documentos en claro y oscuro.
17. Verificar contraste AA en textos y botones críticos.

## Lo que NO voy a tocar

- Lógica de negocio, hooks, servicios, edge functions, base de datos, RAG, AVA orchestrator.
- Estructura de rutas (`App.tsx`).
- `src/integrations/supabase/*` (auto-generados).
- Funcionalidad de los componentes; solo cambio estilos, clases y tokens.

## Riesgos y mitigación

- **Riesgo**: Alguna página tenga colores hard-codeados (p. ej. `bg-blue-500`) que no respondan al cambio de tokens. → Búsqueda con `grep` y reemplazo por tokens semánticos (`bg-accent`, `text-primary`).
- **Riesgo**: La fuente nueva pese mucho. → Cargo solo los pesos usados (300/400/500/600/700) con `display=swap`.
- **Riesgo**: `.ava-report` (informes ejecutivos del asistente) deje de leerse bien en oscuro. → Validación específica con un mensaje real.

## Detalles técnicos (referencia)

- Variables HSL en `:root` y `.dark` dentro de `@layer base` de `src/index.css`.
- Familia tipográfica importada con `@import url(...)` al principio del CSS.
- Tokens shadcn nunca renombrados (compatibilidad con `components/ui/*`).
- Sin librerías nuevas (mantenemos `tailwindcss-animate`, `@tailwindcss/typography`).
- Modo oscuro vía clase `.dark` en `<html>` (ya gestionado por `useTheme`).

## Entregable de la primera iteración

Tras la Fase 2 + Fase 3 + Dashboard + Asistente con tokens nuevos, te paso capturas y validamos antes de extender al resto de páginas. Si algo no encaja, corregimos los tokens centralmente y propaga a toda la app sin tocar página por página.

