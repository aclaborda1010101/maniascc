

# Cambio de paleta: de morado/rosa a azul/verde moderno

Sustituir los acentos iridiscentes actuales (indigo + lila + rosa) por una paleta más fresca y tecnológica basada en azul cian, teal y verde menta. Afecta a fondo animado, sombras de color, gradientes y elementos destacados, manteniendo la estructura glass intacta.

## Cambios

### 1. Tokens de acento (`src/index.css`)

Sustituir los 5 acentos iridiscentes:

| Token | Antes (morado/rosa) | Después (azul/verde) |
|---|---|---|
| `--acc-1` | `220 85% 70%` indigo-azul | `200 95% 65%` azul cian brillante |
| `--acc-2` | `258 70% 74%` lila (firma) | `175 70% 55%` teal (nueva firma) |
| `--acc-3` | `330 65% 72%` rosa | `155 65% 60%` verde menta |
| `--acc-4` | `168 60% 60%` mint | `190 80% 60%` cyan eléctrico |
| `--acc-5` | `38 75% 64%` ámbar | `145 55% 55%` verde esmeralda suave |

El `--accent` global pasa de lila (`258 70% 74%`) a teal (`175 70% 55%`) para que toda referencia a `accent` en componentes shadcn migre automáticamente.

### 2. Fondo (`--background`)

Pequeño viraje del nocturno púrpura-azul actual (`240 35% 6%`) a un nocturno más frío y verdoso: aproximadamente `200 35% 6%`. Sigue siendo oscuro y profundo pero con base cian en vez de violeta, coherente con los nuevos acentos.

### 3. Blobs ambient animados

Las dos manchas grandes (`.ambient::before`, `.ambient::after`) y la tercera (`.ambient-blob-3`) usan ya `--acc-1`, `--acc-2`, `--acc-3` por variable, así que el cambio se propaga sin tocar selectores. Resultado: el fondo respira en azul cian + teal + verde menta en vez de azul + lila + rosa.

### 4. Gradientes signature

`.gradient-iridescent`, `.text-iridescent`, `.gradient-conic`, `.glass-edge::before`, `.pill-iridescent`, `.tab-glass[data-state=active]` consumen los mismos tokens, por lo que adoptan automáticamente el nuevo degradado azul → teal → verde menta.

### 5. Glow utilities

Renombrar semánticamente sin cambiar selectores:
- `.glow-pink` ahora glow verde menta (mismo `--acc-3` reasignado).
- `.glow-mint` ahora cyan eléctrico.
- `.glow-amber` ahora verde esmeralda.

Las clases existentes en componentes siguen funcionando, solo cambia el color que producen.

### 6. Selección de texto

`::selection` pasa de `hsl(var(--acc-1) / 0.35)` indigo a la nueva versión cian, automático al cambiar el token.

## Lo que NO se toca

- Estructura glass (`.glass`, `.glass-strong`, `.glass-tinted`) — solo cambia el matiz que el usuario percibe a través de los acentos.
- Tipografía, radios, espaciados, sombras neutras.
- `--destructive` (sigue rojo) y `--muted-foreground`.
- `.ava-report` y `.prose`.
- Componentes individuales: ninguno se edita, todos consumen tokens.
- Modo claro (la app es dark-only).

## Detalles técnicos

- Único archivo modificado: `src/index.css` — bloque `:root` y `.dark` (mismos valores espejo).
- Sin cambios en Tailwind config, componentes, ni lógica.
- Memoria `mem://style/design-system` se actualiza para reflejar la nueva paleta cian/teal/verde como firma visual.
- Reversible en un único commit si la paleta nueva no convence: basta con restaurar los 5 valores HSL anteriores.

## Resultado esperado

- Fondo animado en tonos cian-teal-verde, más fresco y "tech".
- Botones primarios, gauges, tabs activos, gradientes y glows en azul/verde coherente.
- Misma estructura visionOS y mismo nivel de profundidad glass — solo cambia el color de la luz.

