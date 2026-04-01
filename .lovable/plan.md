

# Plan: Sistema multi-conversación para AVA (estilo ChatGPT)

## Resumen
Añadir soporte para múltiples conversaciones con nombres editables, lista de conversaciones en sidebar, y capacidad de crear/cambiar/renombrar/eliminar chats. Todo persiste en localStorage. El historial completo se envía al orchestrator independientemente de la conversación activa.

## Modelo de datos (localStorage)

```text
ava-conversations: [
  { id: "uuid", title: "Nueva conversación", createdAt: timestamp, updatedAt: timestamp },
  ...
]
ava-conv-{id}: ChatMessage[]   // mensajes por conversación
ava-active-conv: "uuid"        // conversación activa
```

## Cambios por archivo

### 1. `src/hooks/useChatMessages.ts` — Refactor completo
- Nuevo tipo `Conversation = { id, title, createdAt, updatedAt }`
- Estado: `conversations[]`, `activeConversationId`, `messages` (de la conversación activa)
- Funciones nuevas:
  - `createConversation()` — crea nueva conv, la activa, auto-titula con primer mensaje
  - `switchConversation(id)` — cambia a otra conversación
  - `renameConversation(id, title)` — edita título
  - `deleteConversation(id)` — elimina conv y sus mensajes
- `sendMessage` — envía historial completo de TODAS las conversaciones (concatenado, ultimos 10 mensajes globales) al orchestrator
- Auto-título: al enviar el primer mensaje, el título se pone con las primeras ~40 chars del mensaje del usuario
- Exporta todo: `{ conversations, activeConversationId, messages, input, setInput, loading, sendMessage, createConversation, switchConversation, renameConversation, deleteConversation, scrollRef }`

### 2. `src/pages/AsistenteIA.tsx` — Layout con sidebar de conversaciones
- Layout 2 columnas: sidebar izquierdo (w-64) con lista de conversaciones + area de chat
- Sidebar muestra:
  - Botón "Nueva conversación" arriba
  - Lista de conversaciones ordenadas por `updatedAt` desc
  - Cada item: título (editable con doble-click), fecha, botón eliminar
  - Conversación activa resaltada
- Area de chat: igual que ahora pero sin el botón "Nueva conversación" del header

### 3. `src/components/FloatingChat.tsx` — Selector de conversación
- Header: añadir dropdown o indicador de conversación activa
- Botón "+" para nueva conversación
- Al abrir, muestra la conversación activa (misma que la página)
- Mantener compacto: no sidebar completo, solo un select/dropdown con las conversaciones

## Detalles técnicos
- Sin cambios en base de datos ni edge functions
- Persistencia 100% en localStorage (consistente con implementación actual)
- El historial compartido entre conversaciones se logra enviando al orchestrator los últimos N mensajes de TODAS las conversaciones combinadas, ordenados por timestamp
- La migración de datos existentes: si existe `ava-asistente-messages` con mensajes, se crea una conversación "Conversación anterior" y se migran ahí

## Archivos afectados
- **Editar**: `src/hooks/useChatMessages.ts`, `src/pages/AsistenteIA.tsx`, `src/components/FloatingChat.tsx`

