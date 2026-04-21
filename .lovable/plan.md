

# Aplicar referencias del prototipo móvil (AVA_4) a las pantallas pendientes

## Qué falta del rediseño aprobado anteriormente

En la iteración previa quedaron por terminar:

1. **AVA Chat (`/asistente`)** — todavía con el diseño anterior tipo "informe ejecutivo", sin el tratamiento mobile-first del prototipo (avatar gradiente grande arriba, saludo, sugerencias en chips, input flotante con micro+cámara, burbujas usuario con gradiente).
2. **Activo Detail (`/activos/:id`)** — sigue con tabs `Información/Contactos` planos. Falta el hero con score circular "94", mini-grid (Superficie/Valor/Cierre), card "AVA propone" y pipeline horizontal.
3. **Matching individual (`/matching/:id`)** — falta el score circular grande con barras de razones (Tráfico 98, Zona AAA 96…) y los 3 botones circulares ✕/⏱/✓ tipo swipe.
4. **Login (`/login`)** — sigue con estilo claro estándar; conviene alinearlo al dark premium con avatar AVA gradiente y glow.

## Nota sobre el ZIP

El `AVA_4.zip` que subes contiene **`AVA Mobile.html`** (prototipo móvil de una sola página). Es el complemento natural del `AVA_3.zip` (handoff desktop en React) que ya apliqué. En modo plan no puedo descomprimirlo aquí, pero combinado con las dos capturas móviles que enviaste y los componentes ya implementados (BottomNav, FAB AVA, `Mas`, Dashboard hero), tengo el lenguaje visual claro: **avatar gradiente cian→violeta→magenta, scores circulares verde lima, cards `card-premium` con `rounded-3xl`, glow halos sutiles**. Cuando entremos en implementación descomprimiré el HTML para extraer cualquier matiz adicional (animaciones, microinteracciones, copys exactos).

## Cambios técnicos por pantalla

### 1) `src/pages/AsistenteIA.tsx` — versión móvil
- En `<768px`: ocultar sidebar de conversaciones; mostrar header compacto con avatar AVA gradiente 56 px + saludo "Hola {nombre} 👋" + subtítulo "¿En qué te ayudo hoy?".
- Estado vacío: 4 chips horizontales scrollables ("Resumen del día", "Matches calientes", "Redacta email a…", "Genera dossier").
- Burbujas: usuario con `bg-gradient-to-br from-cyan-500 to-violet-600 text-white`, AVA con `card-premium`. Avatar AVA en cada respuesta = círculo 32 px gradient con `glow-ring`.
- Input flotante fijo abajo (sticky con `safe-area-inset-bottom`), `rounded-3xl`, fondo `--card-elevated`, botones micro y adjuntar a izquierda, send gradient a derecha.
- Desktop: mantener layout actual con 2 columnas, solo aplicar nuevos tokens (gradient avatar, burbujas, card-premium).

### 2) `src/pages/LocalDetail.tsx` — hero + pipeline
- Hero `card-premium` con gradient sutil radial:
  - Esquina sup-derecha: `<ScoreRing value={local.ava_score || 0} size={88} />` (componente nuevo, SVG circular, color verde lima).
  - Título 32 px bold, dirección, badges estado.
- Mini-grid 3 columnas: **Superficie** (m²) · **Renta** (€/mes) · **Estado** — números grandes, label pequeño uppercase.
- Card "AVA propone" gradient suave (`from-violet-500/10 to-cyan-500/5`) con avatar AVA, texto generado de `local.descripcion` o placeholder, y 2 CTAs: "Ver matches" / "Generar dossier".
- Pipeline horizontal con 5 dots conectados: Contacto · Análisis · **Matching activo** (resaltado gradient) · Negociación · Cierre.
- Tabs (Información/Contactos) **se mantienen** pero pasan debajo del hero, con estilo `card-premium`.

### 3) `src/pages/Matching.tsx` — vista individual con score grande
- Cuando hay `:id` (match concreto): card central `card-premium` con `<ScoreRing value={94} size={180} />` arriba.
- Debajo: lista de "razones" con `<Progress />` horizontales (Tráfico peatonal 98, Zona AAA 96, Encaje sectorial 92…).
- Footer con 3 botones circulares 64 px: ✕ rojo (descartar) · ⏱ ámbar (aplazar) · ✓ verde (aprobar). Indicador "1/3" centrado arriba.
- Lista (sin `:id`) ya quedó hecha — solo aplicar `card-premium` consistente.

### 4) `src/pages/Login.tsx` — alinear estética
- Fondo `--background` con dos blobs gradient ambient.
- Card central `card-premium`, logo AVA grande (texto gradient + glow), inputs `rounded-2xl`, botón principal `ava-gradient`.
- Eliminar cualquier color claro hardcoded.

### 5) Nuevo componente `src/components/ScoreRing.tsx`
- SVG circular con stroke gradient (verde lima → cian) según `value` (0-100), número grande centrado, label opcional debajo.
- Props: `value`, `size`, `label?`, `colorScheme?` ("score" | "match" | "risk").
- Reutilizable en LocalDetail, Matching, Dashboard cards de oportunidades calientes.

### 6) Pulir BottomNav
- Verificar que el FAB central NO se oculta al estar en `/asistente` (se mantiene activo con animación pulse para indicar "estás aquí").
- Añadir `safe-area-inset-bottom` para iOS notch.

### 7) Aplicar `card-premium` al resto de páginas que aún usan `<Card>` plano
- Pasada rápida en: `Operadores`, `Contactos`, `Documentos`, `Patrones`, `Conocimiento`, `Notificaciones`, `Ajustes`, `Consumo`. Solo cambio de className raíz de cards (no toca lógica).

## Lo que NO se toca

- Lógica de Supabase, hooks, edge functions, `ava-orchestrator`.
- Estructura de rutas (las que añadimos `/mas`, `/matching` se mantienen).
- Sistema de notificaciones, RAG, embeddings, email AVA.
- Funcionalidad de tabs internas (Información/Contactos en LocalDetail, etc.).

## Orden de ejecución

1. Crear `ScoreRing` (componente reutilizable, base para 3 pantallas).
2. Rediseñar `AsistenteIA` (la pantalla que más usas y que más se aleja del nuevo lenguaje).
3. Rediseñar `LocalDetail` (hero + pipeline + AVA propone).
4. Rediseñar `Matching` individual (score + razones + botones).
5. Rediseñar `Login`.
6. Pasada de `card-premium` en páginas secundarias.
7. Descomprimir `AVA_4.zip`, revisar `AVA Mobile.html` y ajustar matices (animaciones, copys, microinteracciones que pueda haber capturado el prototipo).

## Preguntas antes de implementar

1. **ScoreRing data**: el campo `ava_score` no existe aún en `locales`. ¿Lo calculo on-the-fly con un placeholder (ej. `Math.round((superficie/renta)*X)`) o añadimos columna `ava_score` y la pobla un job? Para esta iteración propongo placeholder visual y dejar la columna real para una fase posterior.
2. **"AVA propone" en Activo Detail**: ¿texto estático placeholder de momento, o llamamos a `ava-orchestrator` con un prompt corto al cargar la página (coste por visita)? Recomiendo placeholder + botón "Pedir análisis a AVA" para no inflar costes.
3. **Login**: ¿mantengo el formulario email/password actual y solo cambio estética, o aprovecho para añadir botón "Continuar con Google" que pediste hace tiempo?
4. **Alcance final**: ¿hago las 7 pasos o priorizamos solo 1-4 (las pantallas clave) y dejamos el resto para una pasada posterior?

