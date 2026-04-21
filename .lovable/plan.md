

# Rediseño visual AVA — Dark premium + mobile-first

## Qué cambia (visión)

Pasar de la UI actual (claro por defecto, sidebar tradicional, header con buscador) a la estética de las capturas:

- **Tema oscuro por defecto**, fondo casi negro (`222 47% 4%`) con superficies elevadas y gradientes sutiles violeta→azul.
- **Acento gradiente AVA** (cian → violeta → magenta) reservado al logo, FAB, scores y CTAs principales.
- **Cards "premium"**: `rounded-3xl`, borde 1px translúcido, sombra suave, padding generoso, sin separadores duros.
- **Tipografía** más grande y respirada (Inter pesado en titulares: 28-32 px en móvil, 40 px en hero "Buenos días, Alberto").
- **Mobile-first**: barra inferior fija con 5 ítems (Inicio · Oport. · **AVA (FAB gradiente)** · Match · Más). El sidebar desaparece en móvil; en desktop se mantiene pero rediseñado.
- **Dashboard, Oportunidades, Activo Detail, Matching, AVA chat y "Más"** se rediseñan según las dos capturas.

## Arquitectura visual

```text
Mobile (<768px)                      Desktop (≥768px)
┌─────────────────────┐              ┌──────┬──────────────────────────┐
│ Status bar          │              │      │ Header minimal           │
│ Hero / título       │              │ Side │──────────────────────────│
│                     │              │ bar  │  Contenido               │
│ Cards apiladas      │              │ slim │  con mismas cards        │
│                     │              │ icon │  premium dark            │
│ ↓ scroll            │              │      │                          │
│                     │              │      │                          │
│─────────────────────│              └──────┴──────────────────────────┘
│ ⌂  📁  ✦AVA  ∞  ⋯  │  ← BottomNav fijo, FAB central con gradiente
└─────────────────────┘
```

## Cambios técnicos

### 1) Design tokens (`src/index.css` + `tailwind.config.ts`)
- Cambiar tema **dark por defecto** (`defaultTheme="dark"` en `App.tsx`).
- Nuevos tokens:
  - `--background: 224 47% 4%` (casi negro azulado)
  - `--card: 224 40% 8%` con `--card-elevated: 224 35% 11%`
  - `--border: 224 30% 16%` translúcido
  - `--ava-gradient-from / via / to`: cian `190 95% 60%`, violeta `265 90% 65%`, magenta `320 90% 65%`
  - `--score-ring`: verde lima `145 80% 55%` para gauges tipo "94"
- Nuevo radio: `--radius: 1rem` (todo más redondeado, cards `rounded-3xl`).
- Utilidades en `@layer components`:
  - `.ava-gradient` (background-image lineal)
  - `.ava-text-gradient` (texto con `bg-clip-text`)
  - `.card-premium` (bg + border + shadow estándar)
  - `.glow-ring` (halo difuso violeta para FAB y avatar AVA)
- Mantener compatibilidad con tokens semánticos existentes (no rompe componentes shadcn).

### 2) Layout
- `AppLayout.tsx`: header simplificado en desktop (solo trigger + avatar + notificaciones, sin buscador grande — buscador pasa a Oportunidades). En móvil **header desaparece** y se añade `<BottomNav />` fijo.
- Nuevo `src/components/BottomNav.tsx`: 5 botones (Inicio, Oportunidades, **FAB AVA central**, Matching, Más). FAB redondo 64 px con gradiente y glow. Solo visible `<768px`.
- Nueva ruta `/mas` con la pantalla "Más" de la captura 2 (cartera, inteligencia, cuenta) — en desktop redirige a `/ajustes`.
- `FloatingChat` se oculta en móvil (lo sustituye el FAB del BottomNav que navega a `/asistente`).

### 3) Sidebar (desktop)
- `AppSidebar.tsx`: rediseño visual con fondo `--card`, ítems `rounded-xl`, ítem activo con barra lateral acento gradiente. Logo con `<span className="ava-text-gradient">AVA</span>`. Sin cambios estructurales de navegación.

### 4) Dashboard (`src/pages/Dashboard.tsx`)
- Hero "Buenos días, {nombre}" + subtítulo "Tienes X matches nuevos y Y tareas para hoy".
- Card "AVA · Resumen del día" gradient con avatar AVA y CTA.
- 3 KPI cards (Pipeline · Matches · Cierre) en `grid-cols-3` móvil con números grandes y delta.
- Sección "Para hoy" (tareas) y "Oportunidades calientes" (carrusel de cards con score circular).

### 5) Oportunidades (`src/pages/Proyectos.tsx`)
- Header "Pipeline · N" + título grande + buscador con icono micrófono.
- Filtros en chips horizontales (Todas, Caliente, Negociación, Matching).
- Cards de oportunidad con: avatar gradient circular + score, nombre, ubicación, badge estado, m² y €.

### 6) Activo Detail (`src/pages/LocalDetail.tsx`)
- Hero gradient con score circular grande arriba-derecha (estilo "94 SCORE").
- Título grande, ubicación, mini-grid (Superficie · Valor · Cierre est.).
- Card "AVA propone" con gradient suave y CTA "Ver match" / "Redactar email".
- Pipeline horizontal con dots (Contacto · Análisis · **Matching activo** · Negociación · Cierre).

### 7) Matching (`src/pages/Matching.tsx`)
- Card central con score circular grande "94" + barras de razones (Tráfico peatonal 98, Zona AAA 96…).
- 3 botones grandes circulares abajo: ✕ rojo · ⏱ ámbar · ✓ verde (swipe-friendly).
- Indicador "1/3" con paginación.

### 8) AVA Chat (`src/pages/AsistenteIA.tsx`)
- Vista móvil: avatar AVA gradient grande arriba, "Hola Alberto 👋", input flotante abajo con botón micro y cámara, sugerencias horizontales (chips).
- Burbujas: usuario gradient, AVA card oscura. Mantiene `.ava-report` actual.

### 9) "Más" (`src/pages/Mas.tsx`, **nueva**)
- Header con avatar usuario + badge PRO.
- Secciones (Cartera, Inteligencia, Cuenta) con filas grandes `rounded-2xl`, icono + label + contador a la derecha.

## Estrategia de implementación

1. **Tokens y utilidades** primero (1 archivo CSS + 1 tailwind config) → cambia toda la app sin tocar componentes.
2. **Layout + BottomNav + Sidebar** rediseño.
3. **Pantallas clave** una a una: Dashboard → Oportunidades → Activo Detail → Matching → AVA → Más.
4. Cada pantalla mantiene su lógica de datos actual; solo cambia JSX/estilos.

No se toca: rutas existentes, lógica de Supabase, hooks, edge functions, ni el sistema AVA orchestrator.

## Preguntas antes de implementar

1. **Tema**: ¿forzamos **dark por defecto sin opción de cambio** (como la maqueta) o mantenemos el toggle claro/oscuro y solo cambiamos el default a dark?
2. **Alcance**: ¿hago las **6 pantallas clave** del rediseño (Dashboard, Oportunidades, Activo Detail, Matching, AVA, Más) o solo Dashboard + AVA + BottomNav como primer paso para validar la dirección?
3. **"Más"**: la pantalla "Más" de la captura tiene secciones que ya existen como rutas (Activos, Operadores, Contactos, Patrones, Documentos, Notificaciones, Ajustes). ¿Hago `/mas` como **nuevo agregador móvil** que linka a esas rutas, o reorganizo la navegación?
4. **FAB AVA**: cuando estés ya dentro de `/asistente`, ¿el FAB central debe **ocultarse** o **mantenerse activo** (con otro estado visual)?

