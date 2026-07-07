
# Clasificador de correo M365 — Plan de implementación

Sistema end-to-end: Exchange journaling → buzón captura → Graph → clasificación IA → nutrición app + archivo OneDrive/RAG → bandeja humana.

## 1. Migración BD

**`email_ingest_queue`** — cola cruda de mensajes journaled:
- Campos: `graph_message_id`, `internet_message_id` UNIQUE, `conversation_id`, `received_at`, `from_email`, `from_name`, `to_emails[]`, `cc_emails[]`, `subject`, `body_text` (≤20k), `has_attachments`, `attachments` jsonb, `status` (`pending|needs_review|applied|discarded|error`), `classification` jsonb (proyecto_id, operador_id, contacto_ids, categoria, confianza, resumen, motivo, fuente_clasificacion), `applied_at`, `error_msg`.
- Índices: `status`, `conversation_id`, `received_at`.
- RLS: SELECT/UPDATE solo admin+gestor (patrón `auditoria_ia`). GRANT authenticated+service_role.

**`email_classifier_settings`** — singleton config:
- `umbral_auto numeric default 0.80`, `activo boolean default true`, `updated_at`.
- RLS: solo admin lee/edita; service_role total.
- Semilla: 1 fila.

## 2. Edge function `m365-journal-sync`

- `verify_jwt=false` + validación interna: acepta service-role key o JWT con rol admin/gestor.
- Guard "M365 no configurado" si faltan los 4 secrets (`M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`, `M365_JOURNAL_MAILBOX`).
- Token app-only via `login.microsoftonline.com/.../oauth2/v2.0/token` (client_credentials, scope `.default`).
- Cursor persistido en `sync_state` (`channel='m365_journal'`, owner=primer admin).
- GET Graph `/users/{mailbox}/mailFolders/inbox/messages` con `$filter=receivedDateTime gt {cursor}`, `$top=50`, `$orderby asc`, `$select` mínimo. Paginación `@odata.nextLink` hasta 10 páginas.
- Dedup por `internet_message_id`.
- Filtro basura regex remitentes `noreply|no-reply|notifications|newsletter|mailer-daemon|donotreply` → insert `discarded` con motivo `automatico`.
- `htmlToText` copiado desde `email-sync-outlook`.
- Truncar body a 20k. Actualizar cursor con último `receivedDateTime`.
- Fire-and-forget invocar `email-classify-journal` al terminar.

## 3. Edge function `email-classify-journal`

Misma auth. Toma hasta 20 `pending`. Pipeline por item (parar en primer paso de alta confianza, registrar `fuente_clasificacion`):

- (a) **Owner**: `perfiles.email` ∈ from/to/cc → owner; fallback primer admin.
- (b) **Contactos**: emails externos ∈ `contactos.email` → `contacto_ids`.
- (c) **Herencia de hilo**: último `applied` con mismo `conversation_id` → hereda proyecto/operador (conf 0.95, fuente `hilo`).
- (d) **Patrones aprendidos**: `ai_learned_patterns` con `pattern_type='email_classification'` por email o dominio del remitente.
- (e) **Match determinista de proyecto**: normaliza sin acentos, minúsculas, tokens ≥3 chars sin stopwords, contra `proyectos.nombre` en subject+body. Score por overlap.
- (f) **Vínculos**: contacto→proyecto via `proyecto_contactos`; contacto→operador via campo operador en `contactos`.
- (g) **LLM fallback**: `google/gemini-3.5-flash` via Lovable AI Gateway con tool call estructurado. Input: subject, body[0:3000], remitentes/destinatarios, hasta 150 proyectos y 150 operadores candidatos (id+nombre). Output: `{es_relevante, proyecto_id|null, operador_id|null, categoria, confianza, resumen}`. Registro en `auditoria_ia` (`funcion_ia='email-classify'`, tokens+latencia).
- (h) **Decisión**: `!es_relevante` → `discarded`; `confianza ≥ umbral_auto` → aplicar + `applied`; si no → `needs_review`.

## 4. Aplicar clasificación (helper compartido)

Reutilizado por auto-aplicación y por confirmar/corregir en la bandeja.

- Insert `contact_messages` (`channel='email_journal'`, `external_id=internet_message_id`, direction según from ∈ perfiles). Idempotente `onConflict owner_id,channel,external_id ignoreDuplicates`.
- Upsert `email_threads` por `thread_external_id=conversation_id` (participants, message_count, last_date, summary).
- Insert `email_entities` para proyecto/operador con `confidence`.
- Update `contactos.last_contact`.
- **Adjuntos** (solo si hay `proyecto_id`):
  - GET `/messages/{id}/attachments`; ignorar `isInline=true` o imágenes <20KB.
  - Sube a bucket documentos: `proyectos/{proyecto_id}/email/{filename}`.
  - Sube a OneDrive del buzón: `PUT /users/{mailbox}/drive/root:/AVA/Proyectos/{nombre_saneado}/{filename}:/content`.
  - Insert `documentos_proyecto` (`origen='email_journal'`, `origen_external_id`, dominio según categoría, `fase_rag='pendiente'`), dispara `rag-ingest`.
  - Dedup por `origen_external_id`.
- Marcar item `applied` + `applied_at`.
- Errores por item aislados: `status='error'` + `error_msg`. Prefijo logs `[m365]`.

## 5. UI

- **Página `/bandeja-correo`**: lista `needs_review`, card con asunto/remitente/fecha/snippet, chips propuesta (proyecto, operador, categoría, %confianza) + resumen. Acciones: **Confirmar**, **Corregir** (selects con buscador), **Descartar**. Al corregir → guarda `ai_learned_patterns` con remitente/dominio → proyecto/operador. Ruta en `App.tsx` + sidebar.
- **Badge pendientes** en sidebar + widget dashboard.
- **Admin → sección "Correo M365"**: último sync, contadores por status, botón "Sincronizar ahora", `umbral_auto` editable.

## 6. Cron

`pg_cron` + `pg_net` cada 5min invoca `m365-journal-sync` con service-role key. Insertado vía `supabase--insert` (no migración, contiene URL+key específicas del proyecto).

## Restricciones respetadas

- No se tocan: `wa-evolution-webhook`, `ava-orchestrator`, `rag-proxy`, `generate-match*`, `generate-pdf*`, `email-sync-outlook`.
- UI en español, estilo actual.
- Guard defensivo cuando faltan secrets M365.

## Orden de ejecución

1. Migración (tablas + RLS + GRANTs + semilla settings).
2. `supabase/config.toml` — añadir bloques `verify_jwt=false` para las 2 nuevas funciones.
3. `m365-journal-sync/index.ts`.
4. `email-classify-journal/index.ts` (incluye helper apply compartido inline).
5. Página `BandejaCorreo.tsx` + ruta + sidebar entry + badge.
6. Ampliar `Admin.tsx` con sección "Correo M365".
7. Cron via `supabase--insert`.

¿Procedo con esta implementación?
