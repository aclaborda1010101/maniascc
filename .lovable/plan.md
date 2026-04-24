## Problema

La caja **"Narrativas y memoria"** (componente `EntityNarrativesPanel`) que aparece en `ContactoDetail`, `LocalDetail`, `OperadorDetail`, `ProyectoDetail` y `Patrones` desentona con el resto de la app:

- Header plano (icono pequeño + texto), sin la jerarquía visionOS de las demás cards (`PerfilProfesionalCard`, `PerfilPersonalCard`, etc.).
- Borde duro `border-border` y glass plano `bg-card/40` — el resto usa `border-border/60` con halo + gradiente sutil.
- Selectores de filtro embutidos en el header se atropellan en mobile y desplazan el badge contador.
- Composer (Textarea + selectores + tags + botón) sin separación visual: parece "pegado" debajo de la lista, sin la pestaña/sección dedicada que tienen las demás cards colapsables.
- Tarjetas internas de cada narrativa con `bg-background/40` y borde sólido — rompen la continuidad de glass.
- Inputs y `Textarea` sin el `bg-background/60 border-border/60` consistente con el resto.

## Rediseño (sólo `EntityNarrativesPanel.tsx`)

Mantengo lógica, schema y RLS intactos. Solo cambia presentación.

### 1. Card contenedora — estilo visionOS unificado

```tsx
<Card className="relative overflow-hidden p-0 bg-gradient-to-b from-card/60 to-card/30 backdrop-blur-xl border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset]">
  {/* halo sutil arriba */}
  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
  …
</Card>
```

### 2. Header rediseñado

- Icono `Sparkles` dentro de un **pill glass** (`h-8 w-8 rounded-lg bg-accent/15 border border-accent/25 grid place-items-center`).
- Título `text-sm font-semibold tracking-wide` + subtítulo `text-[10px] uppercase tracking-wider text-muted-foreground/70` ("Memoria contextual").
- Contador de narrativas a la derecha como **chip discreto** (no badge cuadrado).
- Filtros se mueven a una **fila propia** debajo del header, con separador `border-b border-border/40`. En mobile se apilan limpiamente.

### 3. Lista de narrativas

Cada item pasa a:

```tsx
<div className="rounded-xl border border-border/40 bg-background/30 hover:bg-background/50 transition-colors p-3 space-y-2">
```

- Borde más suave (`/40`), hover sutil, esquinas `rounded-xl` (consistente con `PerfilProfesionalCard`).
- Badges de tipo y visibilidad sin cambios de color (la paleta semántica ya está bien); sólo se ajusta tamaño/spacing.
- Timestamp a la derecha en `text-[10px]` con punto separador en lugar de "·" pegado al nombre.

### 4. Composer como sección "Añadir entrada"

Encapsulado en su propio bloque para diferenciarlo:

```tsx
<div className="border-t border-border/40 bg-background/20 px-4 py-4 space-y-3">
  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">
    <Plus className="h-3 w-3" /> Añadir entrada
  </div>
  …
</div>
```

- Selectores con `h-8 text-xs bg-background/60 border-border/60`.
- `Textarea` con `bg-background/40 border-border/60 focus-visible:ring-accent/40`.
- Botón final con la misma variante glass que usa `TabHistorialIA`: `bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md`.

### 5. Responsive (mobile-first, ≤390px)

- Header: título arriba, fila de filtros debajo (no en línea).
- Selectores de filtros con `flex-1 min-w-0` para que no provoquen scroll horizontal (regla de `mem://style/mobile-ux`).
- Lista interna mantiene `max-h-[420px]` con scroll vertical.

### 6. Empty state

Pequeño rediseño con icono atenuado centrado (`Sparkles` en círculo `bg-muted/20`) y la frase actual debajo, en lugar de un párrafo italic suelto.

## Archivos a modificar

- `src/components/EntityNarrativesPanel.tsx` — refactor visual completo (sin tocar `load`, `handleSave`, queries, ni tipos).

## Lo que **no** cambia

- Schema `entity_narratives`, RLS, edge function `ava-execute-action`.
- Tipos `NarrativeTipo`, `NarrativeVisibility`, `TIPO_META` (paleta semántica de tipos se conserva).
- Lógica de filtros, tags, sugerencias y default visibility.
- Props del componente: sigue siendo drop-in en las 5 páginas que lo usan.

## Resultado esperado

La caja queda visualmente alineada con `PerfilProfesionalCard` / `PerfilPersonalCard` / `MetricasComunicacion` y el resto del sistema visionOS dark del proyecto: glass cohesivo, jerarquía clara header → lista → composer, y cero scroll horizontal en mobile.