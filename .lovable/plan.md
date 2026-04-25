
# Vista 360 de Contacto: pipeline completo + UI

Construir el "panel principal del contacto" que pediste: una película viva de la relación alimentada por correos reales (Outlook + Gmail), WhatsApp (Evolution API + import manual), con extracción IA de **próxima acción, tareas pendientes, hitos buenos/malos, alertas de inactividad, oportunidades y contactos vinculados**.

Trabajo grande → lo entrego en **4 fases**, cada una termina con UI usable. Apruebas y arrancamos por la 1.

---

## Fase 1 — Esquema, ingesta de correo y extractor IA base

### 1.1 Modelo de datos nuevo

Tablas (con RLS por `owner_id`):

- **`contact_messages`** — mensajes unificados (email + WhatsApp).
  Campos: `id`, `owner_id`, `contact_id`, `channel` (`email_outlook`/`email_gmail`/`whatsapp`), `external_id`, `direction` (`in`/`out`), `from_email`, `to_emails[]`, `subject`, `body_text`, `body_snippet`, `sent_at`, `thread_external_id`, `sentiment` (`good`/`neutral`/`bad`), `metadata jsonb`, `created_at`. Índices por `(contact_id, sent_at desc)` y por `external_id` único.
- **`contact_tasks`** — tareas/recordatorios extraídos por IA o manuales.
  `id`, `owner_id`, `contact_id`, `title`, `description`, `due_at`, `source` (`ai_email`/`ai_wa`/`manual`), `source_message_id`, `status` (`pending`/`done`/`snoozed`), `priority` (1-5), `created_at`.
- **`contact_milestones`** — hitos buenos/malos de la relación (la "línea de vida" real).
  `id`, `owner_id`, `contact_id`, `event_at`, `tipo` (`positivo`/`tension`/`acuerdo`/`incidencia`/`hito`), `score` (`good`/`bad`/`neutral`), `title`, `description`, `source_message_id`, `auto_generated`.
- **`contact_links`** — vínculos manuales entre contactos.
  `id`, `owner_id`, `contact_a`, `contact_b`, `tipo` (`familiar`/`empresa`/`menciona`/`mismo_grupo`), `notas`, `created_at`. Constraint único por par.
- **`contact_alerts`** — avisos generados (inactividad, oportunidad, riesgo).
  `id`, `owner_id`, `contact_id`, `tipo` (`inactividad`/`oportunidad`/`riesgo`/`compromiso_pendiente`), `severity` (`info`/`warn`/`high`), `mensaje`, `dismissed_at`, `created_at`.

Reutilizar las ya existentes: `email_threads`, `whatsapp_threads`, `contact_interactions` para summaries agregados.

### 1.2 Connectors

Conectar **Microsoft Outlook** y **Gmail** vía connector gateway (te lanzo el picker en build). Las llamadas al API se hacen desde edge functions, nunca desde el cliente.

### 1.3 Edge functions de ingesta

- **`email-sync-outlook`** — pagina `/me/messages?$top=100&$orderby=receivedDateTime desc` y matchea `from.emailAddress.address` o cualquier `toRecipients` contra `contactos.email`. Inserta en `contact_messages` con `external_id` único (id Outlook). Soporta cursor (`$skip` o delta link guardado en `email_send_state` reutilizado o tabla nueva `sync_state`).
- **`email-sync-gmail`** — equivalente vía `users/me/messages?q=newer_than:30d`, format=full, decodifica payload y matchea por header `From`/`To`.
- Ambas se invocan: (a) bajo demanda desde la UI ("Sincronizar ahora") y (b) pg_cron cada 15 min.
- **`contact-extract-signals`** — recibe `contact_id`, lee últimos N mensajes nuevos sin procesar, llama a `google/gemini-2.5-flash` con prompt que devuelve JSON estructurado:
  ```json
  {
    "tasks": [{"title","due_at","priority","description"}],
    "milestones": [{"event_at","tipo","score","title","description"}],
    "next_action": {"title","when","why"},
    "sentiment_per_message": [{"message_id","sentiment"}],
    "topics": ["..."],
    "opportunities": ["..."]
  }
  ```
  Inserta en `contact_tasks`, `contact_milestones`, actualiza `contacto.perfil_ia` (campos nuevos: `proxima_accion`, `tareas_pendientes`, `topics_recientes`, `oportunidades`).

### 1.4 Cron jobs
- Sync Outlook cada 15 min, Gmail cada 15 min.
- Extractor por contacto cuando hay nuevos mensajes (cola simple o trigger).
- **`contact-alerts-scan`** diario: marca contactos con `last_contact > 21d` como `inactividad`, detecta tareas vencidas → `compromiso_pendiente`.

---

## Fase 2 — Rediseño de `ContactoDetail` (panel principal vivo)

Layout nuevo en 3 zonas:

```text
┌─────────────────────────────────────────────────────────┐
│ Header: Nombre · Empresa · Cargo · Estado relación chip │
├─────────────────────────────────────────────────────────┤
│ ZONA 1 — RESUMEN ACCIONABLE (siempre arriba)            │
│ ┌─Próxima acción─┐ ┌─Tareas pendientes─┐ ┌─Alertas───┐ │
│ │ "Mandarle      │ │ • Enviar dossier  │ │⚠ 23 días   │ │
│ │  propuesta el  │ │ • Confirmar visita│ │ sin hablar │ │
│ │  jueves"       │ │ • Llamar viernes  │ │💡 Posible  │ │
│ │ Generado de:   │ │ [+ nueva]         │ │ oportunidad│ │
│ │ email 12/04    │ │                   │ │            │ │
│ └────────────────┘ └───────────────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ZONA 2 — LÍNEA DE LA RELACIÓN (el "histórico gráfico") │
│  Timeline horizontal con hitos: 🟢 acuerdo, 🔴 tensión, │
│  🟡 sin respuesta, ⭐ cierre. Cada hito clickable abre  │
│  el mensaje origen.                                     │
├─────────────────────────────────────────────────────────┤
│ ZONA 3 — PERFIL Y CONTEXTO (acordeón)                   │
│  · Datos clave (chips IA)                               │
│  · Perfil profesional / personal                        │
│  · Métricas de comunicación                             │
│  · Contactos vinculados [+ vincular]                    │
│  · Negociaciones                                        │
│  · Brief de negociación (existente)                     │
├─────────────────────────────────────────────────────────┤
│ ZONA 4 — CONVERSACIONES (tabs)                          │
│  [Email] [WhatsApp] [Notas] — feed unificado por canal  │
└─────────────────────────────────────────────────────────┘
```

Nuevos componentes en `src/components/contacto/`:
- `ProximaAccionCard.tsx`, `TareasPendientesCard.tsx`, `AlertasCard.tsx`
- `LineaRelacion.tsx` — timeline horizontal real (hitos de `contact_milestones`), reemplaza la línea de "mensajes/mes" como vista principal. La gráfica antigua queda en un toggle "Ver actividad".
- `ContactosVinculadosPanel.tsx` — listado + diálogo "Vincular contacto" (combobox con búsqueda).
- `ConversacionFeed.tsx` — feed unificado de `contact_messages` filtrable por canal.

Refactor:
- `TabEmail.tsx` y `TabWhatsApp.tsx` pasan a leer de `contact_messages` filtrado por canal.
- `LineaDeVida.tsx` actual queda renombrada `ActividadMensual.tsx` y se usa como gráfica secundaria.

---

## Fase 3 — WhatsApp vía Evolution API

- Edge function **`wa-evolution-webhook`** (`verify_jwt = false`, secret en header) que recibe eventos `messages.upsert` de Evolution, normaliza y matchea `key.remoteJid` contra `contactos.whatsapp` (normalización E.164). Inserta en `contact_messages` con `channel='whatsapp'`. Dispara `contact-extract-signals`.
- URL del webhook visible en Ajustes para que la pegues en tu instancia Evolution.
- Mantener importación `.txt` actual (parser ya escrito) → ahora vuelca a `contact_messages` también.
- Secret necesario: `EVOLUTION_WEBHOOK_SECRET` (te lo pediré al desplegar).

---

## Fase 4 — Inteligencia transversal

- **Detector de oportunidades**: `contact-opportunity-scan` cron diario. Cruza topics recientes de contactos × proyectos activos × activos disponibles. Genera `contact_alerts` tipo `oportunidad` con explicación.
- **Detector de patrones de relación**: identifica contactos "dormidos con histórico positivo" (>30d sin contacto + sentiment_avg good) → recordatorio en dashboard.
- **Brief enriquecido**: el botón existente "Generar Brief" ahora ingiere también `contact_messages`, `contact_milestones` y `contact_tasks` en su contexto.
- Widget **"Pendientes hoy"** en `Dashboard.tsx`: agrega `contact_tasks` con `due_at <= today` y alertas `high`.

---

## Detalles técnicos

- **Privacidad / RLS**: todas las tablas nuevas con `owner_id = auth.uid()` y políticas estrictas. Mensajes son sensibles.
- **Coste IA**: extractor usa `gemini-2.5-flash` (barato), batch de 20 mensajes por llamada. Estimado < $0.001 / contacto / día.
- **Idempotencia**: `external_id` único en `contact_messages` evita duplicados en re-syncs.
- **Sync incremental**: guardar `last_synced_at` por (owner, channel) en tabla `sync_state`.
- **Matcheo de contacto**: por email exacto en fase 1; futuro: fuzzy + dominios + alias.
- **Rate limits**: Outlook/Gmail Graph soportan miles de req/min, paginamos y respetamos backoff.

---

## Lo que NO hace este plan (para acotar)

- No cambia el sistema de auditoría/coste IA (ya existe).
- No toca el RAG general — los mensajes pueden indexarse después en dominio nuevo `comunicaciones` si lo pides.
- No hace OCR de adjuntos de email (fase futura).

---

## Orden de entrega sugerido

1. Migraciones + connect Outlook/Gmail + sync inicial → ves correos cargados (1 turno)
2. Extractor IA + tablas tasks/milestones/alerts → ves tareas y hitos generados (1 turno)
3. Rediseño `ContactoDetail` con las 4 zonas (1 turno)
4. Webhook Evolution + scans de alertas/oportunidades + widget Dashboard (1 turno)

¿Apruebas y arrancamos por la fase 1?
