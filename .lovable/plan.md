## Objetivo

Extender el contrato `PerfilIA` con dos bloques opcionales —`perfil_profesional` y `perfil_personal`— y renderizarlos en `/contactos/:id` con la UI especificada. Validación Zod estricta para el generador. `perfil_personal` queda detrás de un toggle privacy-first con auditoría.

Además: respondo el estado de **Evolution API / WhatsApp** y propongo siguiente hito.

---

## 1. Extensión del contrato

**`src/types/perfilIa.ts`** — añadir tipos y campos opcionales:

- `NivelDecision = 'decisor' | 'ejecutor' | 'influencer' | 'info'`
- `TonoEmocional = 'positivo' | 'neutral' | 'tenso' | 'variable'`
- `interface PerfilProfesional { cargo_actual, empresa_actual, sector, nivel_decision, trayectoria[], proyectos_mencionados[], skills_detectadas[], estilo_comunicacion, fortalezas[], patrones_negociacion[] }`
- `interface PerfilPersonal { intereses[], personalidad[], relacion_con_fran, eventos_personales[], tono_emocional_promedio }`
- En `PerfilIA`: `perfil_profesional?: PerfilProfesional; perfil_personal?: PerfilPersonal;`
- Actualizar `parsePerfilIA` para hacer passthrough de ambos bloques cuando sean objetos.

**`src/lib/perfilIaSchema.ts`** — añadir:

- `NivelDecisionSchema = z.enum(['decisor','ejecutor','influencer','info'])`
- `TonoEmocionalSchema = z.enum(['positivo','neutral','tenso','variable'])`
- `PerfilProfesionalSchema` y `PerfilPersonalSchema` siguiendo spec exacto (todas listas como `z.array(z.string())`, strings sin `.min(1)` para no bloquear cuando el generador devuelve `""`; el tipado los exige presentes).
- Sumar ambos como `.optional()` dentro de `PerfilIaSchema`.

**`src/mocks/perfilIaMock.ts`** — añadir bloques de ejemplo realistas para QA visual con `?mock=1`.

---

## 2. Componentes nuevos

**`src/components/contacto/PerfilProfesionalCard.tsx`** (visible por defecto):

- `<Card>` con header: `cargo_actual @ empresa_actual` + `<Badge>` de `nivel_decision` con paleta:
  - `decisor` → emerald, `ejecutor` → blue, `influencer` → violet, `info` → muted
- Fila de chips: `sector` (chip destacado) + `skills_detectadas`.
- `Collapsible` "Estilo y fortalezas" → muestra `estilo_comunicacion` (texto) y lista bullet de `fortalezas`.
- `Collapsible` "Patrones de negociación" → bullets de `patrones_negociacion`.
- Pie: mini-timeline vertical de `trayectoria` + chips de `proyectos_mencionados`.

**`src/components/contacto/PerfilPersonalCard.tsx`** (oculto por defecto):

- Estado interno `revealed` (default `false`).
- Si `!revealed` → render mínimo: card con icono candado + título "Perfil personal" + descripción corta + `<Button>` "👁️ Ver perfil personal". Al hacer click:
  1. `setRevealed(true)` (queda abierto durante toda la sesión: el estado vive en el componente, no se persiste, no se cierra al cambiar tab dentro de la página).
  2. Inserta fila en `usage_logs` con `action_type: 'reveal_perfil_personal'` y `metadata: { target_type: 'contacto', target_id: contactoId }`. `user_id` = `(await supabase.auth.getUser()).data.user?.id`. Fire-and-forget (no bloquea UI; logueamos error a consola si falla).
- Si `revealed` → renderiza el contenido completo:
  - Disclaimer arriba: alerta sutil con icono `Info` y texto exacto: *"Información sensible inferida por IA desde emails. Usar con criterio."*
  - Header: `relacion_con_fran` + `<Badge>` de `tono_emocional_promedio` (positivo=emerald, neutral=muted, tenso=rose, variable=amber).
  - Chips: `intereses`.
  - `Collapsible` "Personalidad" → chips de `personalidad`.
  - Sección "Eventos personales" (solo si array no vacío): lista con icono candado por item.
  - Pie en text-xs muted: *"Basado en análisis de emails — confidencial"*.

Diseño: coherente con `PerfilIaSection` y memoria `style/design-system` (visionOS, glass, acentos cian/teal).

---

## 3. Integración en `ContactoDetail`

Tras `<PerfilIaSection>`, insertar:

```tsx
{(perfil?.perfil_profesional || perfil?.perfil_personal) && (
  <div className="grid md:grid-cols-2 gap-4">
    {perfil.perfil_profesional && (
      <PerfilProfesionalCard data={perfil.perfil_profesional} />
    )}
    {perfil.perfil_personal && (
      <PerfilPersonalCard data={perfil.perfil_personal} contactoId={contacto.id} />
    )}
  </div>
)}
```

No se añaden cambios al fetch existente: `contactos.perfil_ia` ya viaja entero; los bloques nuevos se leen del mismo jsonb sin migración de schema en BD.

---

## 4. Privacidad y auditoría

- `usage_logs` ya existe con RLS correcto (`auth.uid() = user_id` en INSERT). Encaja con la spec usando:
  - `action_type = 'reveal_perfil_personal'` (la tabla no tiene columna `action`, sí `action_type`).
  - `metadata = { target_type: 'contacto', target_id: <uuid> }` (no hay columnas dedicadas; jsonb cubre la spec sin migración).
- RLS de `contactos` se respeta automáticamente: si el usuario no puede ver el contacto, nunca llega a la página.

---

## 5. Estado de Evolution API + WhatsApp (respuesta)

**Lo que hay hoy:**
- Edge function `evolution-manage` desplegada y funcional. Lee credenciales de `perfiles.evolution_instance_url / evolution_api_key / evolution_instance_name` o las acepta en el body. Soporta acciones de gestión de instancia.
- Tabla `whatsapp_threads` creada (con RLS por owner/visibility, índices por `contact_id` y `contact_phone`, check de `origen IN ('manual','export','evolution_api')`). **Está vacía** (0 filas).
- `contactos.wa_message_count` existe como contador agregado.
- UI: `src/components/contactos/tabs/TabWhatsApp.tsx` ya está montada como tab.

**Lo que NO existe todavía:**
- **Tabla de mensajes individuales WhatsApp** — solo está `whatsapp_threads` (cabecera/resumen). Hace falta `whatsapp_messages` con `thread_id`, `direction (in|out)`, `body`, `media_url`, `wa_message_id`, `sent_at`, `status`, etc.
- Webhook receptor de Evolution API (no hay edge function que persista eventos entrantes).
- Realtime: no se ha activado `supabase_realtime` para tablas WA.
- Vínculo automático `whatsapp_threads → contactos` por número (hay índice por phone, falta el upsert).

**Hito sugerido (cuando termines la generación):** migración para `whatsapp_messages` + edge function `whatsapp-webhook` (recibe eventos de Evolution → upsert thread + insert message + match por phone a `contactos`) + activar realtime sobre `whatsapp_messages` para que `TabWhatsApp` reciba mensajes en vivo. ETA estimada 1 sesión.

---

## Archivos afectados

- `src/types/perfilIa.ts` — extender interfaz + parser.
- `src/lib/perfilIaSchema.ts` — añadir schemas + enums.
- `src/mocks/perfilIaMock.ts` — añadir bloques mock.
- `src/components/contacto/PerfilProfesionalCard.tsx` — nuevo.
- `src/components/contacto/PerfilPersonalCard.tsx` — nuevo (incluye toggle + log).
- `src/pages/ContactoDetail.tsx` — montar grid de los dos cards bajo `PerfilIaSection`.

Sin cambios en BD (todo cabe en `contactos.perfil_ia` jsonb existente y `usage_logs` ya soporta el shape).
