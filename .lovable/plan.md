

# Configurar correo + WhatsApp internos para AVA

## Objetivo

Dar a AVA dos canales de comunicación propios del sistema (no del usuario) para que, cuando se lo pidas desde el chat ("manda un email a X", "envía un WhatsApp a Y"), pueda hacerlo de forma autónoma. Los usuarios seguirán pudiendo conectar sus IMAP/Gmail personales para análisis — esto es un canal separado, exclusivo de la plataforma.

## Arquitectura propuesta

```text
┌──────────────────────────────────────────────────────────┐
│  USUARIO en chat: "AVA, manda un email a Juan diciendo…" │
└──────────────────────────────────────────────────────────┘
                           ↓
                   ava-orchestrator
                  (detecta intención)
                           ↓
           ┌───────────────┴───────────────┐
           ↓                               ↓
   tool: send_email                tool: send_whatsapp
           ↓                               ↓
  ava-send-email (edge fn)        ava-send-whatsapp (edge fn)
           ↓                               ↓
   Lovable Emails                 Twilio API (connector)
   (notify@avaia.link)            (+34 XXX XXX XXX)
           ↓                               ↓
        Destinatario                  Destinatario
           ↓                               ↓
   Log en ava_outbound_log (auditoría completa)
```

## Canal 1 — Email saliente de AVA

**Solución:** Lovable Emails (infraestructura nativa, ya tienes el dominio `avaia.link` publicado).

- Remitente fijo: `ava@notify.avaia.link` (o el subdominio que verifiquemos).
- Edge function `ava-send-email` que recibe `{to, subject, body_html, body_text, reply_to?}`.
- Cola pgmq con reintentos automáticos, supresión de bounces, sin coste extra de API externa.
- Configuración del dominio mediante diálogo guiado de Lovable (NS records → verificación automática).

**Nueva tool en AVA:** `send_email(to, subject, body, reply_to?)` con confirmación previa obligatoria (igual que las acciones existentes vía `AvaPendingActionCard`) — el usuario verá el borrador y podrá aprobar/cancelar antes del envío.

## Canal 2 — WhatsApp saliente de AVA

**Decisión técnica:** existen 3 opciones; mi recomendación es **Twilio WhatsApp Business API** por estas razones:

| Opción | Pros | Contras |
|---|---|---|
| **Twilio (recomendado)** | Connector nativo en Lovable, número dedicado, API estable, soporta plantillas | Requiere alta en Twilio + verificación WhatsApp Business (~3-5 días) |
| Evolution API (la que ya usáis para usuarios) | Ya está integrada | Pensada para QR de móvil personal — no apta como canal "del sistema" |
| Meta Cloud API directa | Gratis hasta 1.000 msg/mes | Setup más complejo, requiere Business Manager |

Edge function `ava-send-whatsapp` que recibe `{to, message, media_url?}` y llama a Twilio vía connector gateway. Misma confirmación previa que email.

## Pantalla de configuración

Nueva pestaña en `/ajustes` llamada **"Canales de AVA"** (separada de "Conexiones" que es para los IMAP/WhatsApp del usuario):

```text
┌─ Canales de comunicación de AVA ────────────────────┐
│                                                      │
│  📧 Email del sistema                                │
│  Estado: ✅ Verificado · ava@notify.avaia.link       │
│  [Cambiar dominio]  [Ver historial de envíos]        │
│                                                      │
│  💬 WhatsApp del sistema                             │
│  Estado: ⚠ No configurado                            │
│  [Conectar Twilio]                                   │
│                                                      │
│  ⚙ Reglas                                            │
│  ☑ Pedir confirmación antes de enviar                │
│  ☑ Registrar todos los envíos en auditoría           │
│  ☐ Permitir envío automático sin confirmación        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Solo visible para rol `admin`.

## Auditoría y trazabilidad

Nueva tabla `ava_outbound_log`:
- `id`, `canal` (email|whatsapp), `to`, `subject`, `body`, `status` (pending|sent|failed)
- `triggered_by_user_id`, `conversation_id`, `message_id`, `provider_id` (Twilio SID o email message_id)
- `created_at`, `sent_at`, `error`

Toda interacción saliente queda registrada y consultable desde "Ver historial de envíos".

## Detalles técnicos

1. **Diálogo de dominio email** (`<lov-open-email-setup>`) — guía al usuario a verificar `avaia.link` con NS records.
2. **`email_domain--setup_email_infra`** — provisiona pgmq, send_log, suppression list, cron de drenado.
3. **Edge function `ava-send-email`** — wrapper que enqueueá vía RPC `enqueue_email` con `purpose='transactional'` y plantilla mínima.
4. **`standard_connectors--connect` Twilio** — flujo guiado para conectar cuenta Twilio (Account SID + API Key). Recordar habilitar **SMS/WhatsApp Geo Permissions** y **Pumping Protection**.
5. **Edge function `ava-send-whatsapp`** — POST a `/Messages.json` con `From=whatsapp:+...` y `To=whatsapp:+...` vía gateway.
6. **Migración `ava_outbound_log`** + RLS (admin lee todo, gestor solo lo suyo).
7. **Tools en `ava-orchestrator`**:
   - `send_email`: genera `pending_action` que requiere confirmación → al confirmar invoca `ava-send-email`.
   - `send_whatsapp`: idem con `ava-send-whatsapp`.
8. **System prompt de AVA** ampliado con reglas: nunca enviar sin confirmación explícita, siempre mostrar borrador, validar formato E.164 en teléfonos.
9. **UI en `/ajustes`** — nueva pestaña `TabCanalesAva` con estado de cada canal y botones de configuración.

## Preguntas antes de implementar

1. **Dominio email**: ¿uso `notify.avaia.link` (subdominio limpio) o prefieres otro como `ava.avaia.link` o `mail.avaia.link`?
2. **Twilio WhatsApp**: ¿tienes ya cuenta Twilio o la creamos desde cero? El alta de WhatsApp Business tarda 3-5 días hábiles en aprobarse — ¿avanzamos con email primero y WhatsApp después?
3. **Confirmación de envío**: ¿siempre obligatoria (más seguro) o permitimos modo "auto-send" para ciertos casos (más ágil pero arriesgado)?
4. **Alcance inicial**: ¿solo envío saliente (AVA manda) o también recepción (que un email/WhatsApp entrante a `ava@avaia.link` cree automáticamente una nota o tarea en el sistema)?

