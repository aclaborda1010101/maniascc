
The user is asking about architecture for a massive email + attachment ingestion (48k emails, 100k attachments). They need to decide:
1. Global RAG vs per-user RAG with sharing toggle
2. How this integrates with contact sharing across users

Let me think about the right architecture:

**Current state:**
- `document_chunks` has `proyecto_id` and `dominio` but NO `user_id` / `owner_id` / `shared` flags
- `contactos` has `creado_por` but no sharing model
- RAG search (rag-proxy-v4) filters by `proyecto_id` and `dominio` only
- Storage bucket `documentos_contratos` is private but RLS on `document_chunks` is "Authenticated can view" (everyone sees everything)

**The right answer:** Per-owner with sharing flag. Reasons:
1. Privacy/GDPR: personal emails between client and user are sensitive
2. 48k emails × multiple chunks = massive data; needs scoping for relevance
3. AVA's answers should reflect the asking user's network, not random users'
4. Same model needed for contacts (toggle "compartir en red")

**Proposed model:**
- Add `owner_id` (uuid) and `visibility` ('private' | 'shared' | 'global') to `document_chunks`, `documentos_proyecto`, and `contactos`
- RLS: SELECT allowed when `visibility = 'shared'` OR `owner_id = auth.uid()` OR admin
- RAG search filters: include chunks where owner=me OR visibility=shared
- UI toggle in Contactos: "Compartir con mi equipo"
- Email ingestion: bulk import per user, defaults to private, user can mark folders/threads as shared

**Scope of work:**
This is a big architectural change. I should present the plan and let user approve. Since they're asking a strategic question, I'll recommend the hybrid approach and lay out the implementation.

Keep plan concise.

---

## Plan: Arquitectura RAG multi-tenant con visibilidad granular

### Recomendación
**Híbrido owner + shared**, no global puro. Cada documento/contacto/chunk tiene un `owner_id` y un nivel de `visibility`. El usuario decide qué comparte con la red de la aplicación.

**Por qué no global**:
- 48k correos privados entre cliente-usuario son sensibles (GDPR)
- AVA debe responder con el contexto del usuario que pregunta, no mezclar redes
- Contactos personales no deben filtrarse a otros usuarios sin consentimiento

**Por qué no solo privado**:
- Pierdes el efecto red (un contacto/contrato útil para todo el equipo se desperdicia)
- F&G necesita inteligencia agregada (patrones, benchmarks, operadores conocidos)

### Modelo de visibilidad (3 niveles)
| Nivel | Quién lo ve | Uso típico |
|---|---|---|
| `private` | Solo el owner + admins | Correos personales, notas internas |
| `shared` | Todos los usuarios autenticados | Contactos de red, dossiers de operadores, contratos modelo |
| `global` | Sistema (RAG entrena patrones agregados) | Benchmarks, normativa, mercado |

### Cambios en BBDD (migración)
1. Añadir `owner_id uuid` y `visibility text default 'private'` a:
   - `document_chunks`
   - `documentos_proyecto`
   - `contactos` (ya tiene `creado_por`, renombrar lógica → `owner_id`; añadir `visibility`)
2. Backfill: registros existentes → `visibility='shared'` (mantener acceso actual)
3. Actualizar RLS: `SELECT` permitido si `visibility IN ('shared','global') OR owner_id = auth.uid() OR has_role(admin)`
4. Índices en `(owner_id, visibility)` para performance con 48k+ registros

### Cambios en RAG
- `rag-ingest`: capturar `owner_id = auth.uid()` y `visibility` desde el cliente (default `private`)
- `rag-proxy-v4`: añadir filtro `visibility IN ('shared','global') OR owner_id = current_user` a la búsqueda FTS
- AVA orchestrator: el `rag_search` tool ya pasa el JWT; respetará automáticamente el scope

### Pipeline de ingesta de correos masivos
1. **Importador batch dedicado** (nueva edge function `email-bulk-ingest`):
   - Acepta archivo .mbox / .pst / carpeta IMAP
   - Procesa por lotes de 100, agrupa por hilo (`thread_id`)
   - Crea 1 documento por hilo (no por correo individual) → reduce 48k a ~5-10k docs
   - Adjuntos: deduplicación por hash MD5 antes de subir a Storage
2. **Default visibility**: `private` (el usuario decide después qué promover a `shared`)
3. **Indexación**: chunks con `owner_id`, `dominio='emails'`, metadata con `from`, `to`, `subject`, `date`

### UI: control de compartición
1. **Pestaña "Privacidad" en Ajustes**: toggle global "Compartir mis contactos con la red" (afecta contactos nuevos)
2. **En Contactos**: switch por contacto "Visible para el equipo"
3. **En importador de correos**: paso final con 3 opciones — "Solo yo" / "Mi equipo" / "Solo metadatos compartidos (perfilado IA agregado)"

### Archivos afectados
| Archivo | Cambio |
|---|---|
| `supabase/migrations/` (nueva) | Añadir owner_id + visibility, RLS, índices |
| `supabase/functions/rag-ingest/index.ts` | Capturar owner_id + visibility |
| `supabase/functions/rag-proxy-v4/index.ts` | Filtro de visibilidad en search |
| `supabase/functions/email-bulk-ingest/` (nueva) | Pipeline batch correos |
| `src/pages/Contactos.tsx` | Switch "compartir" por contacto |
| `src/pages/Ajustes.tsx` | Pestaña Privacidad + toggle global |
| `src/components/contactos/ImportContactosModal.tsx` | Selector visibilidad al importar |

### Decisión que necesito de ti
Antes de implementar, confirma una cosa: los **48k correos** ¿son de **un solo usuario** (su histórico personal de Outlook/Gmail) o son **correos compartidos del equipo F&G** (ej. buzón comercial común)? Esto cambia si el default debe ser `private` o `shared`.

Si confirmas el enfoque híbrido, procedo con la migración + cambios de RAG + UI en una única implementación.
