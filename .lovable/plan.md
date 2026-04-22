

# Unificar fondo y estilo glass al mockup de referencia

Aplicar a toda la app el mismo lenguaje visual del mockup: fondo púrpura-azul muy oscuro (no negro neutro), superficies glass con tinte ligeramente cálido y bordes apenas visibles, y cards con sutil degradado iridiscente interno como las del panel "Documentos" del diseño.

## Cambios

### 1. Fondo global (`src/index.css`)

- `--background` pasa de `224 30% 4%` (casi negro) a un tono nocturno púrpura-azul más profundo y con más vida: aproximadamente `240 35% 6%`.
- `body { background-color }` y el `style={{ background }}` inline del `AppLayout` se igualan al nuevo token.
- Se intensifican los blobs ambient (`--acc-1`, `--acc-2`, `--acc-3`) bajando opacidad pero aumentando radio para que el fondo respire en lila/azul como la referencia, sin ruido.

### 2. Glass unificado (`.glass`, `.glass-strong`, `.card-premium`)

Reescribir las superficies para igualar el aspecto del mockup:

- Fondo: `linear-gradient(180deg, hsl(240 30% 100% / 0.05), hsl(240 30% 100% / 0.025))` en vez del flat blanco al 4%. Da el sutil "fade" que se ve en cada card del mockup.
- Borde: `1px solid hsl(240 30% 100% / 0.07)` (más fino y con leve tinte).
- Radio: subir a `1.5rem` (24px) para igualar el redondeo de la referencia.
- Sombra interior superior + sombra exterior más profunda para que la card "flote" sobre el fondo.
- `backdrop-filter: blur(40px) saturate(1.6)` para todas las glass (homogeneizar — hoy varían entre 20/32/40px).

### 3. Cards de contenido con tinte iridiscente sutil

Nueva clase `.glass-tinted` (variante de `.glass`) que añade un degradado muy tenue de `--acc-1 → --acc-2` al 4-6 % en el fondo, replicando las tarjetas tipo "Contrato Gran Vía 7" del mockup. Se aplica desde Tailwind como utility opcional para listas/grids principales (Dashboard, Activos, Operadores, Documentos, Oportunidades).

### 4. Header sticky y sidebar

- El topbar de `AppLayout.tsx` (hoy `hsl(224 30% 4% / 0.6)`) usa el nuevo fondo `hsl(240 35% 6% / 0.55)` y mismo blur que las glass para consistencia.
- Sidebar (`AppSidebar.tsx`): la superficie glass adopta automáticamente el nuevo `.glass`, sin tocar el componente.

### 5. Inputs y tabs

- `.input-glass` y `.tabs-glass` heredan el nuevo tono (mismo gradiente sutil + borde 0.07) para que buscadores y selectores no rompan la coherencia visual.

## Lo que NO se toca

- Paleta de acentos `--acc-1..5` (se mantienen los 5 iridiscentes actuales).
- Tipografía, tamaños y radios de botones.
- Estructura de componentes ni lógica.
- Modo claro (la app es dark-only).
- Estilos `.ava-report` y `.prose` (ya tienen su propio tratamiento).

## Detalles técnicos

- Único archivo modificado: `src/index.css` (tokens + clases `.glass`, `.glass-strong`, `.glass-tinted` nueva, `.input-glass`, `.tabs-glass`, `.ambient`).
- Segundo archivo: `src/components/AppLayout.tsx` para alinear el `style` inline del contenedor raíz y del header al nuevo `--background`.
- Sin cambios en Tailwind config: todos los tokens viven en variables CSS ya consumidas por la config existente.
- Sin migraciones, sin nuevas dependencias, sin tocar componentes individuales — el cambio se propaga porque ya usan `.glass`, `.card-premium` o `bg-background`.

## Resultado esperado

- Todas las páginas (Dashboard, Oportunidades, Activos, Operadores, Documentos, Patrones, Conocimiento, AVA, etc.) comparten el mismo fondo púrpura-azul nocturno y el mismo glass del mockup.
- Las tarjetas se distinguen mejor del fondo gracias al degradado interno sutil y al borde más fino.
- Coherencia total en sidebar, topbar, tabs, inputs y cards.

