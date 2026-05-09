## Añadir modo de tema claro

Actualmente la app está bloqueada en modo oscuro (`forcedTheme="dark"` en `App.tsx`) y varios componentes tienen colores oscuros "hardcoded" en línea (fondos `hsl(200 35% 5%)`, headers translúcidos oscuros, etc.). Para soportar tema claro hay que:

### 1. Definir paleta clara en `src/index.css`
- Añadir un bloque `.light { ... }` (o usar `:root` para light y `.dark` para dark, invirtiendo el actual) con tokens HSL equivalentes:
  - `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--border`, `--sidebar-*` adaptados a fondo claro (p. ej. `--background: 200 30% 97%`, `--foreground: 200 35% 10%`).
  - Mantener los acentos iridiscentes (`--acc-1..5`) iguales para preservar identidad de marca; ajustar solo luminosidad si se ve mal sobre claro.
- Revisar reglas globales `glass`, `ambient-blob-*`, gradientes que asumen fondo oscuro y crear variantes claras (mismas clases, distintos valores según `.dark`/`.light`).

### 2. Habilitar conmutación en `App.tsx`
- Quitar `forcedTheme="dark"`, dejar `defaultTheme="dark"` y `enableSystem={true}` (o configurable).
- Añadir `disableTransitionOnChange` para evitar flashes.

### 3. Sustituir colores hardcoded por tokens
Ficheros con `hsl(200 35% ...)` u otros valores fijos detectados (al menos):
- `src/components/AppLayout.tsx` (fondo wrapper y header desktop).
- `src/components/BottomNav.tsx`, `AppSidebar.tsx`, `NotificationCenter.tsx`, paneles AVA, etc.
- Reemplazar por `hsl(var(--background))`, `hsl(var(--card) / 0.55)`, `border-border`, `text-foreground/55`, etc.
- Recorrer con `rg "hsl\("` para localizar todos los casos y migrar de forma sistemática.

### 4. Añadir un selector de tema
- Crear `ThemeToggle` (icono Sol/Luna/Sistema) usando `useTheme()` de `next-themes`.
- Colocarlo en:
  - Topbar desktop de `AppLayout` (junto a la campana y avatar).
  - Página `Ajustes` como sección "Apariencia" con tres opciones: Claro / Oscuro / Sistema (persistencia automática vía `next-themes` en `localStorage`).

### 5. QA visual
- Revisar Dashboard, Asistente, fichas Plan A/B/C, Operadores, Documentos en ambos temas para detectar contrastes rotos y ajustar tokens puntuales.

### Notas técnicas
- `next-themes` ya está integrado; basta con quitar el `forcedTheme` y montar el toggle.
- El sistema de glassmorphism funcionará en claro siempre que los blobs ambient y los `backdrop-filter` se calibren con tokens (no con valores literales).
- No se toca lógica de negocio, solo presentación.

### Alcance opcional (confirmar)
¿Quieres que el tema claro también afecte a documentos generados (PDFs / informes McKinsey-style) o solo a la UI de la app? Por defecto **solo UI** — los PDFs mantienen su estética actual.
