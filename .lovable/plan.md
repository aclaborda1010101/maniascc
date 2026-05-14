## Resumen honesto

**Sobre la limpieza de coste**: Lo ya hecho (cron 30s→2min + purga de logs) fue útil y de coste 0. Lo que NO recomiendo: re-chunking ni borrar dominios — el ahorro es marginal y arriesga calidad. Mejor monitorizar 48h.

**Sobre el bug del RAG con La Milla Arganda**: Verificado en BD — los 1.957 chunks del proyecto están `visibility='shared'`. AVA NO los rechaza por privacidad. El problema es de **recuperación**: al preguntar en lenguaje natural sobre un proyecto sin tenerlo seleccionado, el orquestrador llama al RAG sin `proyecto_id`, y la búsqueda semántica entre 565k chunks no encuentra los relevantes con queries genéricas como "dame toda la info histórica".

---

## Plan de acción

### 1. NO ejecutar (quedan descartados)
- Re-chunking masivo (opción C)
- Borrado de dominios poco usados
- Purga de docs antiguos sin auditar uso

### 2. Fix del RAG: detección de proyecto por nombre

**Cambio en `supabase/functions/ava-orchestrator/index.ts`** (o en `rag-proxy`):

a) **Resolver proyecto por nombre antes de buscar**: cuando la pregunta del usuario contenga un sustantivo propio que coincide con `proyectos.nombre`, inyectar automáticamente `filters.proyecto_id` antes de llamar a `rag-proxy`.

```text
query: "info histórica sobre la milla de arganda"
  → match contra proyectos.nombre (ILIKE / similarity)
  → encontrado: a2308471-... "La Milla Arganda"
  → llama rag-proxy con filters.proyecto_id = a2308471-...
```

b) **Fallback agresivo en `rag-proxy`**: cuando el RAG no encuentra chunks (top-20 vacío/irrelevante), hacer una segunda pasada con `ILIKE` sobre nombres de documentos vinculados al proyecto detectado (ya existe el bloque `fb` en líneas 200-215, pero solo busca por palabras de la pregunta — añadir búsqueda por nombre de documento + `documentos_proyecto.proyecto_id`).

c) **Mejorar log de trazabilidad**: cuando el RAG devuelva 0 resultados o baja confianza, AVA debe decir explícitamente *"no encontré chunks relevantes para X criterio"* en vez de la respuesta evasiva actual ("información bien guardada bajo llave"). Esto hace el bug visible en lugar de invisible.

### 3. Mejora UX: badge de proyecto activo en el chat

Cuando el usuario está en `/proyectos/:id` y abre AVA, pasar `proyecto_id` automáticamente como filtro implícito (probablemente ya se hace en `ProyectoRAG.tsx` pero no en el chat global). Verificar y, si falta, añadir.

### 4. Validación

Después de los cambios, repetir manualmente:
- "dime toda la información histórica que tienes sobre La Milla Arganda"
- "qué operadores hay en La Milla Arganda"
- "negociaciones recientes con [operador X]"

Y comprobar en logs de `rag-proxy` que `proyecto_id` viaja en los filtros y que `contextChunks.length > 0`.

---

## Detalles técnicos (para referencia)

**Estado actual verificado**:
- `proyectos` tiene `id=a2308471-698b-43a2-b928-9816b9a3d4c8` para "La Milla Arganda"
- 1.957 chunks `dominio='general'`, `visibility='shared'` para ese proyecto
- 30 documentos en `documentos_proyecto` con `visibility='shared'`, `owner_id=NULL`
- RLS de `document_chunks`: `visibility IN ('shared','global') OR owner_id = auth.uid()` → permite acceso a `admin@atlas.fg`
- Filtro post-RPC en `rag-proxy:177-180` también pasa para `shared`

**Conclusión**: el bug es 100% de **recuperación semántica**, no de seguridad ni de RLS.

**Archivos a tocar**:
- `supabase/functions/ava-orchestrator/index.ts` — añadir resolver de proyecto por nombre
- `supabase/functions/rag-proxy/index.ts` — mejorar fallback con `ILIKE` sobre `documentos_proyecto.nombre`
- (Opcional) `src/components/FloatingChat.tsx` o el contexto del chat — pasar `proyecto_id` cuando estás dentro de un proyecto
