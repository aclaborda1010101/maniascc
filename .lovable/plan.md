

# Plan: Rediseño Glassmorphism global (claro + oscuro)

> ⚠️ Sigo sin ver imagen adjunta. Avanzo con un sistema glass "Apple Vision / macOS Big Sur" de intensidad media. Si luego me pasas la referencia, ajusto paleta y gradientes en una segunda iteración.

## Sistema de diseño glass

### Tokens nuevos en `src/index.css`
Añado variables HSL + alpha para superficies translúcidas:

```text
--glass-bg            : superficie translúcida principal
--glass-bg-strong     : variante para popovers/diálogos
--glass-border        : borde con brillo sutil (white/black con alpha)
--glass-highlight     : línea superior brillante (1px)
--glass-shadow        : sombra suave azulada/oscura
--glass-blur          : 16px (mediano)
--glass-saturate      : 180%
```

- **Modo claro**: `--glass-bg: 0 0% 100% / 0.5`, borde `255 255 255 / 0.6`, highlight blanco.
- **Modo oscuro**: `--glass-bg: 222 47% 9% / 0.5`, borde `255 255 255 / 0.08`, highlight blanco 10%.

### Fondo de la app (capa base que justifica el blur)
En `body` añado un fondo con **3 blobs gradientes** fijos (azul accent + violeta + cian) muy difuminados y baja opacidad. Sin animación pesada — solo `position: fixed`, `filter: blur(120px)`, `opacity: 0.35`. En claro los blobs son pastel; en oscuro saturados.

### Utilidades Tailwind nuevas
En `@layer components` de `index.css`:

```text
.glass            → bg-[hsl(var(--glass-bg))] backdrop-blur-[16px] backdrop-saturate-[180%] border border-[hsl(var(--glass-border))] shadow-[var(--glass-shadow)]
.glass-strong     → variante con más opacidad para modales
.glass-hover      → hover:bg-white/10 (dark) / hover:bg-white/70 (light)
.glass-highlight  → ::before con línea blanca 1px arriba (efecto cristal)
```

## Componentes a tocar

### 1. Sidebar (`src/components/ui/sidebar.tsx` + `AppSidebar.tsx`)
- Sustituir `bg-sidebar` por `glass` translúcido con `backdrop-blur-2xl`.
- Borde derecho con gradiente sutil.
- Items activos: `bg-white/10` (dark) o `bg-white/60` (light) en lugar del color sólido.
- En mobile (Sheet): mantener glass para el drawer.

### 2. Header global (`src/components/AppLayout.tsx`)
- `<header>` pasa de `bg-card` a `.glass` con `sticky top-0 z-40`.
- Buscador con fondo `bg-white/40 dark:bg-white/5` y borde glass.
- Avatar y notificaciones sin cambios estructurales, solo redondeo y brillo.

### 3. Cards (`src/components/ui/card.tsx`)
- Variante por defecto: `.glass` en lugar de `bg-card`.
- Mantener variante sólida opcional (`<Card variant="solid">`) por si en algún sitio rompe la legibilidad (ej. tablas densas tipo Conocimiento).

### 4. Diálogos / Sheets / Popovers / Dropdowns
- `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `command.tsx`: aplicar `.glass-strong` (más opaco, blur 24px) para asegurar legibilidad sobre cualquier fondo.
- Overlay: pasar de `bg-black/80` a `bg-black/40 backdrop-blur-sm`.

### 5. Tabs, Inputs, Buttons
- `tabs.tsx`: `TabsList` con glass + indicador activo brillante.
- `input.tsx` y `textarea.tsx`: fondo `bg-white/40 dark:bg-white/5`, borde glass, focus con ring accent + glow.
- `button.tsx`: variante `outline` y `ghost` con glass; `default` se mantiene sólido para que el CTA destaque.

### 6. AVA chat (`AsistenteIA.tsx`, `FloatingChat.tsx`, `AvaRealtimeOverlay.tsx`)
- Burbujas de mensaje: glass con borde brillante.
- Overlay de llamada: `bg-black/30 backdrop-blur-3xl` con orbe central manteniendo gradientes actuales.
- `FloatingChat`: cápsula glass flotante.

### 7. KPI Cards y gráficos (Dashboard, Conocimiento, Patrones)
- Cards glass.
- Recharts: backgrounds transparentes (ya lo son), tooltip con glass.

## Detalles técnicos

- **Performance**: `backdrop-filter` puede pesar en móviles antiguos. Añado fallback `@supports not (backdrop-filter: blur(1px))` que usa fondo sólido.
- **Accesibilidad / contraste**: opacidad mínima 50% para garantizar AA en texto. Diálogos suben a 75%.
- **Dark mode**: variables ya separadas en `:root` y `.dark` — solo añadir las `--glass-*` nuevas en ambos bloques.
- **Sin librerías nuevas**: todo con Tailwind + CSS vars existentes.
- **Scope**: cambios concentrados en `src/index.css`, `tailwind.config.ts` (nada nuevo realmente, uso arbitrary values), y los 8-10 componentes UI listados. Las páginas no necesitan cambios porque heredan de `Card`, `Dialog`, `Tabs`, etc.

## Entregables
1. Variables glass en `src/index.css` (claro + oscuro) + utilidades `.glass`, `.glass-strong`, `.glass-highlight`.
2. Capa de blobs gradientes fija en `body`.
3. Refactor de `card.tsx`, `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `input.tsx`, `textarea.tsx`, `command.tsx`, `sidebar.tsx`.
4. `AppLayout.tsx` header sticky glass + sidebar translúcido.
5. Ajuste fino en `FloatingChat.tsx` y burbujas de `AsistenteIA.tsx`.

Tras aplicar, revisamos juntos en `/oportunidades/:id`, `/dashboard`, `/asistente` y `/conocimiento` para validar contraste y, si subes la referencia, hago una pasada de afinado de colores/blobs.

