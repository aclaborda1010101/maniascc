

# Plan: Catalogación documental masiva + retirada de Expert Forge MoE externo

## Respuesta rápida a tus tres preguntas

### 1. ¿Qué hace el botón "Clasificar/Reclasificar con IA" (✨)?
Llama a la edge function `document-classify`, que con Gemini 2.5 Flash:
- Lee nombre + mime + muestra de contenido
- Asigna **categoría** (taxonomía: 12 disponibles en BD)
- Asigna **nivel de sensibilidad** (público/interno/confidencial/restringido)
- Genera **nombre normalizado** (`2026-04-20_legal_contrato_arrendamiento.pdf`)
- Detecta **fecha del documento** y un **resumen de 1 frase**

Al subir un archivo ya se dispara automáticamente. El botón sirve para **reclasificar** uno suelto si la IA se equivocó o si quieres refrescar metadatos.

### 2. ¿Falta un botón "Clasificar TODO automáticamente"?
**Sí, falta.** Ahora mismo no existe acción masiva. Si subes 50 docs antes de que existiera la IA, hay que clicar uno a uno.

### 3. ¿Son suficientes las 7 categorías del selector?
**No.** El selector de upload muestra 7 (`contrato, financiero, dossier, informe, plano, correo, otro`) pero la BD ya tiene **12 taxonomías**: activo, operador, operacion, legal, financiero, presentacion, correo, whatsapp, plano, multimedia, investigacion, sin_clasificar. Está desincronizado.

### 4. Arquitectura RAG: ¿interna o externa (MoE Expert Forge)?
La aplicación tiene **dos sistemas paralelos**:
- **RAG interno** (lo que usamos hoy): `rag-proxy` + `rag-ingest` + tabla `document_chunks` + Gemini 2.5 Flash. Funciona, está integrado en AVA, ProyectoRAG, Documentos, etc.
- **Expert Forge externo MoE**: `expert-forge-proxy` apuntando a `nhfocnjtgwuamelovncq.supabase.co` con 7 specialists (ATLAS, FORGE7, MATCHING, AUDITORIA, SCRAPING, COORDINADOR, NEGOCIACION). Solo se usa en 4 sitios marginales: pestaña "Auditoría externa" de `/auditoria`, tarjeta de health-check en `/ajustes` y `/admin`, y como tool `expert_forge` del orquestador AVA (que casi nunca elige porque el RAG interno es más rápido).

**Conclusión**: Expert Forge ya no aporta valor (duplica capacidades del RAG interno + Lovable AI). Lo desactivamos.

---

## Lo que vamos a hacer

### A) Catalogación documental — mejoras

**A1. Sincronizar las 12 categorías en el selector de upload**
En `ProyectoDocumentos.tsx`, sustituir las 7 opciones hard-codeadas por las 12 reales de `documentos_taxonomia` (cargadas con `fetchTaxonomias()` que ya existe). Mostrar icono + nombre.

**A2. Botón "Clasificar todo lo pendiente"**
Nuevo botón en el header de la tabla de documentos (página de Oportunidad → Documentos, y también en `/documentos` global):
- Detecta documentos sin `taxonomia_id` o con `procesado_ia = false`
- Muestra contador: *"23 documentos sin clasificar"*
- Al pulsar, lanza `classifyDocument()` en lote (paralelo controlado: 3 a la vez) con barra de progreso
- Al terminar, también lanza `ingestDocument()` para los no indexados
- Toast final: *"23 clasificados · 18 indexados"*

**A3. Propuesta de categorías adicionales (opcional, te las dejo a decisión)**

Las 12 actuales cubren bien el caso inmobiliario. Pero podríamos añadir:
- **`due_diligence`** — informes técnicos de DD (separar de "legal")
- **`urbanismo`** — licencias, certificados energéticos, cédulas
- **`fiscal`** — IBI, IVA, facturas tributarias (separar de "financiero")
- **`marketing`** — campañas, branding del centro (separar de "presentacion")
- **`acta_reunion`** — minutas de reuniones (hoy van a "correo" u "otro")

Mi recomendación: añadir **due_diligence**, **urbanismo** y **acta_reunion**. Las otras dos son matiz fino que se pueden vivir como subtipo de los existentes.

### B) Retirada de Expert Forge MoE externo

**B1. Eliminar tool `expert_forge` del orquestador AVA**
Quitar la definición de la tool y el branch `if (fnName === "expert_forge")` en `supabase/functions/ava-orchestrator/index.ts`. AVA seguirá funcionando con sus tools internas (db_query, rag_search, run_intelligence, generate_pdf, etc.).

**B2. Eliminar página/sección de Expert Forge en UI**
- `src/pages/Auditoria.tsx`: quitar el bloque "Expert Forge — Especialista Auditoría" (textarea + botón consultar)
- `src/pages/Ajustes.tsx`: quitar tarjeta "Conexión Expert Forge" (status + ping + lista specialists)
- `src/pages/Admin.tsx`: quitar pestaña/sección "Conexión IA externa", lista SPECIALISTS_INFO y botón testConnection

**B3. Eliminar código muerto**
- Borrar `supabase/functions/expert-forge-proxy/index.ts` (al borrar la función, Lovable la desregistra del deploy)
- Borrar `src/services/expertForge.ts`
- Limpiar imports huérfanos

**B4. Secrets a desactivar (te los digo, los borras tú desde Cloud)**
- `EXPERT_FORGE_API_KEY`
- `JARVIS_PATTERNS_API_KEY`
- `JARVIS_PATTERNS_URL`
Una vez no quede código que los lea, son seguros de eliminar.

**B5. Actualizar memoria del proyecto**
Eliminar `mem://integrations/expert-forge` y referencia en el index, añadir constraint: *"Expert Forge MoE externo retirado: usar solo RAG interno (rag-proxy + document_chunks)"*.

---

## Detalles técnicos (sección para repasar luego)

- `document-classify` ya persiste `taxonomia_id`, `nombre_normalizado`, `nivel_sensibilidad`, `fecha_documento`, `resumen_ia`, `procesado_ia` en `documentos_proyecto`. No requiere cambios de schema.
- El batch usará `Promise.allSettled` en chunks de 3 con `setProgress` para feedback visual.
- Para añadir las 3 nuevas taxonomías (B if approved), se hace con una migración INSERT en `documentos_taxonomia`.
- El orquestador AVA tras quitar `expert_forge` mantiene 9 tools, suficientes.
- Las páginas `/auditoria` y `/admin` quedan más limpias mostrando solo el sistema interno.

---

## Preguntas antes de implementar

1. ¿Añado las 3 categorías nuevas (**due_diligence**, **urbanismo**, **acta_reunion**) o dejamos las 12 actuales?
2. ¿Confirmas la retirada COMPLETA de Expert Forge (frontend + backend + secrets)? ¿O prefieres dejar `expert-forge-proxy` desplegado por si vuelve a hacer falta?
3. El botón "Clasificar todo" ¿lo quieres solo en la pestaña Documentos de cada Oportunidad, o también en la página global `/documentos`?

