## Diagnóstico previo (verificado contra BD)

Antes de tocar nada, el estado real es distinto del esperado:

| Frente | Supuesto bug | Realidad en BD/código |
|---|---|---|
| `LineaDeVida` gris | Falta sentiment | El código YA pinta sentiment. De 11.210 puntos: **8.343 tienen label** (se pintan), **2.654 son good/bad pero solo 51 sin label**. La línea principal va en cian (`--accent`) por diseño. |
| `Documentos` paginación 500 | Límite fijo 500 | Ya está paginado a 100/página con "Cargar más" (total real **68.967 docs**). No hay límite de 500 en el código. |
| `OperadorDetail` vacío | Bug en queries | Queries correctas. **Datos linkeados escasos**: solo 34 operadores con contactos, 49 con doc_links, 52 subdivision_activos, 33 matrices con `contacto_*` poblado. |

Los tres componentes funcionan. Lo que falta son **mejoras UX** que hagan visible el enriquecimiento.

## Cambios propuestos

### 1. `LineaDeVida` — colorear la línea, no solo los puntos

**Problema real**: la línea principal es cian uniforme. El sentiment se ve solo en `ReferenceDot` etiquetados. Resultado visual: parece "monocromo" aunque haya datos.

**Cambio** (`src/components/contacto/LineaDeVida.tsx`):
- Reemplazar `<Line>` única por un `<defs><linearGradient>` con stops por mes según sentiment dominante (verde/cian/rojo) → la línea cambia de color a lo largo del tiempo.
- Pintar **todos** los `dot` con color de sentiment (no solo los etiquetados): `dot={(props) => <Dot fill={sentimentColor[p.sentiment]} … />}`.
- Mantener `ReferenceDot` con halo más grande solo para puntos con `label`.
- Añadir leyenda discreta abajo: ● Buena · ● Neutra · ● Tensa.

### 2. `Documentos` — paginación más usable

**Problema real**: con 68k docs, "Cargar más" de 100 en 100 es lento. Pero scroll infinito real es peor. Mejor: **paginación numerada + página más grande**.

**Cambio** (`src/pages/Documentos.tsx`):
- Subir `PAGE_SIZE` de 100 → 50, pero añadir paginación numerada (Anterior / 1 2 3 … N / Siguiente) en lugar de "Cargar más" acumulativo.
- Refactor a `currentPage` state, `fetchDocumentos({ from: page*50, to: page*50+49 })`.
- Mantener filtros y búsqueda; resetear a página 1 cuando cambian.
- Añadir indicador "Página X de Y · Z documentos".
- Estilo visionOS coherente (botones glass como en otros sitios).

### 3. `OperadorDetail` Vista 360 — placeholders honestos + enrichment fallback

**Problema real**: para los ~20 operadores enriquecidos los componentes funcionan. Para el resto se ven 4 cards vacías.

**Cambios**:

**a) `OperadorInfoCard`**: si `contacto_email` está vacío pero hay contactos en `contactos.operador_id`, mostrar el primer contacto como "contacto inferido de la red" con badge sutil.

**b) `ContactosAsociadosTable`** (`src/components/operador/ContactosAsociadosTable.tsx`): además de `operador_id`, hacer fallback por dominio email del operador → encontrar contactos cuyo email coincide con el dominio del `contacto_email` de la matriz. Marcar como "vínculo inferido".

**c) `DocumentosLinkeadosList`**: añadir 3er fallback — buscar documentos cuyo `nombre_normalizado` ILIKE `%{operador.nombre}%` (limitado a 20). Útil para operadores grandes (Mercadona, Lidl) sin links explícitos.

**d) `SubdivisionesGrid`**: si no hay subdivisiones, mostrar empty state claro con CTA "Crear subdivisión" en lugar de card vacía silenciosa.

**e) Aplicar estilo glass visionOS** (gradiente teal/cian sutil, `backdrop-blur-xl`, halos) a los 4 cards para alinear con `EntityNarrativesPanel` rediseñado.

## Lo que NO se toca

- Schema de BD, RLS, edge functions.
- `EntityNarrativesPanel` (ya rediseñado).
- Lógica de enriquecimiento backend (eso lo lanza Fran/Gorka cuando se libere quota).
- `PerfilIaSection` y derivados.

## Detalles técnicos

- `LineaDeVida`: reescribir el `<Line>` con `stroke="url(#lineaVidaGradient)"` y generar stops dinámicos basados en `data.map((p,i) => ({ offset: i/(n-1), color: sentimentColor[p.sentiment] }))`.
- `Documentos`: `Math.ceil(totalDocs / PAGE_SIZE)` para totalPages; renderizar máximo 5 páginas centradas en la actual + ellipsis.
- `OperadorDetail`: parallel queries dentro de cada subcomponente con `Promise.all` para no encadenar latencia. Queries de fallback solo si la principal devuelve 0 resultados.

## Resultado esperado

- Timelines visualmente vivos (línea coloreada por sentiment, no solo dots).
- Navegación fluida en 68k docs (página 1 a página 1.380 sin scroll infinito).
- Vista 360 de operador útil incluso para los no enriquecidos (vía fallbacks por dominio/nombre).
