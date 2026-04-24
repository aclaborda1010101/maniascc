## Feature: Entrada conversacional + Memoria narrativa de entidades

Permitir que AVA cree/actualice operadores, contactos y activos por conversación, y que guarde "historias" sobre cualquier entidad (operador, contacto, activo, proyecto, subdivisión) que se mezclen en el RAG y se muestren en las pantallas de detalle.

---

### 1. Migración SQL — tabla `entity_narratives`

```sql
CREATE TABLE public.entity_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN
    ('operador','contacto','activo','proyecto','subdivision')),
  entity_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN
    ('historia','experiencia_buena','experiencia_mala','negociacion','nota')),
  narrativa text NOT NULL,
  embedding vector(768),
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_narratives_entity   ON public.entity_narratives(entity_type, entity_id);
CREATE INDEX idx_narratives_embedding ON public.entity_narratives
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.entity_narratives ENABLE ROW LEVEL SECURITY;
-- RLS: lectura para todo authenticated; insert/update/delete solo autor o admin
```

Trigger `set_updated_at` reusando `update_updated_at_column()` que ya existe.

### 2. Nuevas herramientas en `ava-orchestrator`

Añadir 4 tools al array `TOOLS` y sus ramas en el `Promise.all`. Todas devuelven una **propose_action-like** (no ejecutan): así el usuario sigue confirmando con la tarjeta ya existente. Para mantener compatibilidad y no duplicar UI, se reutiliza `propose_action` extendiendo `ALLOWED_MUTATE` con `entity_narratives` y añadiendo `action: "upsert"`.

Estrategia simpler:
- **`upsert_operador`**, **`upsert_contacto`**, **`upsert_activo`** → internamente generan un `propose_action` con `action: "upsert"` y la tabla correspondiente (`operadores`/`contactos`/`activos`). El LLM sigue viendo herramientas con nombres semánticos claros, pero la confirmación pasa por el flujo conocido.
- **`add_entity_narrative`** → genera un `propose_action` con `table: "entity_narratives"`, `action: "insert"`, datos `{entity_type, entity_id, tipo, narrativa}`. AVA debe primero resolver `entity_id` (con `db_query` o `search_data`) antes de proponer.

Detalles en cada tool:
- `upsert_operador`: `{nombre*, sector?, descripcion?, contacto_email?, contacto_telefono?, contacto_nombre?, presupuesto_min?, presupuesto_max?, superficie_min?, superficie_max?, logo_url?}`. Match por nombre case-insensitive si existe.
- `upsert_contacto`: `{email*, nombre?, apellidos?, empresa?, cargo?, telefono?, operador_id?, activo_id?, linkedin_url?}`. Match por email.
- `upsert_activo`: `{nombre*, direccion?, ciudad?, codigo_postal?, superficie_m2?, precio_renta?, descripcion?, coordenadas_lat?, coordenadas_lng?}`. Match por nombre+ciudad.
- `add_entity_narrative`: `{entity_type*, entity_id*, tipo*, narrativa*}`.

### 3. `ava-execute-action` — soporte upsert + entity_narratives

- Añadir `"entity_narratives"` a `ALLOWED_TABLES` con `creator_column = "autor_id"`.
- Añadir branch `action === "upsert"`: hace `select` previo por `match`, si existe → update, si no → insert. Para narrativas, siempre insert.
- Tras insertar narrativa, lanzar embedding asíncrono (fire-and-forget call a `rag-embed-chunks` adaptado, o función propia mínima). MVP: dejar `embedding` null y que un job posterior lo rellene; para no bloquear, añadir tool helper `embed-narratives` ligera. **Decisión**: hacerlo síncrono dentro de `ava-execute-action` llamando al gateway de embeddings (`google/text-embedding-004`, mismo modelo que `rag-proxy`) — la latencia añadida es ~300ms y simplifica el flujo.

### 4. `AvaPendingActionCard` — soporte nuevas tablas y `upsert`

- Añadir `entity_narratives: "narrativa"` al `TABLE_LABEL`.
- Añadir verbo `upsert → "Guardar"`.
- Sin más cambios: la tarjeta sigue mostrando los campos.

### 5. RAG híbrido — incluir narrativas como fuente

Modificar `rag_hybrid_search` para hacer `UNION ALL` con narrativas:

```sql
narr AS (
  SELECT
    n.id, NULL::uuid AS documento_id, NULL::uuid AS proyecto_id,
    ('[' || n.tipo || '] ' || n.narrativa) AS contenido,
    'narrativa' AS dominio,
    jsonb_build_object(
      'source','narrativa', 'entity_type', n.entity_type,
      'entity_id', n.entity_id, 'tipo', n.tipo
    ) AS metadata,
    ts_rank(to_tsvector('spanish', n.narrativa),
            plainto_tsquery('spanish', p_question))::real AS fts_rank,
    (n.embedding <=> p_query_embedding)::real AS vec_distance
  FROM public.entity_narratives n
  WHERE n.embedding IS NOT NULL
    AND (
      to_tsvector('spanish', n.narrativa) @@ plainto_tsquery('spanish', p_question)
      OR (n.embedding <=> p_query_embedding) < 0.35
    )
  ORDER BY n.embedding <=> p_query_embedding
  LIMIT p_limit
)
```

Las narrativas siempre entran (no se filtran por `p_dominio`/`p_dominios` salvo que `p_dominios` contenga explícitamente `'narrativa'` — añadir esa lógica). Por defecto se incluyen para que las "historias" aparezcan junto con docs.

### 6. UX — Bloque "Narrativas" en pantallas de detalle

Crear componente reutilizable `<EntityNarrativesPanel entityType entityId />`:
- Carga `entity_narratives` filtrado por `entity_type`+`entity_id` ordenado desc.
- Muestra cards con badge de `tipo`, fecha, autor (resolviendo `perfiles.nombre`), texto.
- Input multilinea + selector de `tipo` + botón "Guardar nota". Inserta directamente en la tabla (no via AVA) llamando a `ava-execute-action` con `table: "entity_narratives", action: "insert"` para mantener el embedding sync.

Integrar en:
- `OperadorDetail.tsx` — `entity_type="operador"`
- `ContactoDetail.tsx` — `entity_type="contacto"`
- `LocalDetail.tsx` — `entity_type="activo"` (mapea a la tabla `activos`)
- `ProyectoDetail.tsx` (al final del Resumen) — `entity_type="proyecto"`

### 7. Prompt updates en orquestador

Añadir al `SYSTEM_PROMPT` sección "MEMORIA NARRATIVA":
- Cuando el usuario te cuente una historia/experiencia/anécdota sobre un operador/contacto/activo/proyecto, usa `add_entity_narrative`.
- Antes, resuelve el `entity_id` con `db_query` o `search_data`. Si hay ambigüedad, pregunta.
- Cuando el usuario pregunte "¿qué historia/experiencia tenemos con X?", llama a `rag_search` con el nombre — ya devuelve narrativas mezcladas con docs.
- Para crear/actualizar entidades por chat, usa las tools nuevas `upsert_operador`/`upsert_contacto`/`upsert_activo`.

### 8. Migración pendiente del usuario (post-deploy)

Cuando el backend esté listo, Fran/Gorka correrán su script Python para migrar narrativas implícitas en emails → `entity_narratives`. El plan deja esto **fuera** (lo hace el usuario con `service_role`).

---

### Archivos tocados

- `supabase/migrations/<timestamp>_entity_narratives.sql` (nuevo)
- `supabase/migrations/<timestamp>_rag_hybrid_with_narratives.sql` (nuevo, sustituye función)
- `supabase/functions/ava-orchestrator/index.ts` (nuevas tools + prompt)
- `supabase/functions/ava-execute-action/index.ts` (upsert + entity_narratives + embedding sync)
- `src/components/EntityNarrativesPanel.tsx` (nuevo)
- `src/pages/OperadorDetail.tsx`, `ContactoDetail.tsx`, `LocalDetail.tsx`, `ProyectoDetail.tsx` (insertar panel)
- `src/components/AvaPendingActionCard.tsx` (label + verbo upsert)

### Notas de criterio

- Narrativas RAG: dimension 768 (`text-embedding-004`) coincide con `document_chunks.embedding`.
- No se modifica `document_links` — narrativas viven aparte, indexadas por `(entity_type, entity_id)`.
- `entity_type='subdivision'` aceptado por el CHECK aunque hoy no se exponga en UI (alineado con el spec del usuario).
- RLS: lectura abierta a authenticated (mismas reglas que docs); modificación restringida a autor o `admin`.
- Embedding sync en `ava-execute-action`: si falla el gateway, se inserta igual con `embedding=null` y se logea (un job nightly puede rellenar luego — fuera de scope).
