

## Plan: Aislar conversaciones en AVA + sidebar plegable

### Problemas detectados

**1. "Pensando en todas las conversaciones" / "escribe lo mismo en todas"**

Causa real (revisado `useChatMessages.ts`):
- El estado `loading` es global al hook. Cuando envías en la conversación A y cambias a B, B también aparece "pensando".
- Peor: cuando llega la respuesta, se hace `setMessages(prev => [...prev, assistantMsg])` sobre el estado actual (que ya es B), así que el mensaje de A se pinta en B. En BD se guarda en A correctamente, pero al refrescar/cambiar ves duplicidades raras.
- Si envías en A y B en paralelo (o si la lista se recarga), la respuesta de A puede acabar visible en B porque `setMessages` no comprueba a qué conversación pertenece.

**2. Sidebar de conversaciones siempre visible**

En `AsistenteIA.tsx` el sidebar de 256px en desktop no se puede plegar.

### Cambios

**A. `src/hooks/useChatMessages.ts` — aislar estado por conversación**

1. Convertir `loading` en un `Set<string>` de IDs de conversación con request en vuelo (`loadingConvs`). Exponer `loading` derivado: `loadingConvs.has(activeConversationId)`.
2. En `sendMessage`: capturar `convId = activeConversationId` al inicio. Tras recibir respuesta, hacer `setMessages(prev => convId === activeConversationId ? [...prev, assistantMsg] : prev)`. Si el usuario ya cambió, no tocar el estado visible (el mensaje queda en BD y aparecerá al volver).
3. Igual tratamiento para el mensaje de error.
4. Marcar/desmarcar `convId` en `loadingConvs` al iniciar/finalizar.
5. En `switchConversation`: cancelar el `setInput("")` solo si la conversación cambia realmente; ya está bien pero asegurar que no resetea si es la misma.

**B. `src/pages/AsistenteIA.tsx` — sidebar plegable en desktop**

1. Añadir estado `desktopSidebarOpen` (default `true`, persistido en `localStorage` con clave `ava-conv-sidebar`).
2. Envolver el sidebar de 256px con animación de ancho (`w-64` ↔ `w-0` con `overflow-hidden transition-all`).
3. Añadir botón en el header del chat (icono `PanelLeftClose` / `PanelLeftOpen`) que togglea, visible siempre en desktop. En mobile sigue usándose el `Sheet`.
4. Cuando está colapsado, mostrar también un mini-botón flotante o el mismo botón del header para reabrir.

**C. `src/components/FloatingChat.tsx` — coherencia**

Aplica los mismos fixes del hook automáticamente al usar la misma lógica. Verificar que el indicador "pensando" del FAB también respeta el aislamiento (no requiere cambios extra).

### Archivos modificados

- `src/hooks/useChatMessages.ts` (lógica de aislamiento por conversación)
- `src/pages/AsistenteIA.tsx` (sidebar plegable desktop)

### Resultado esperado

- Cada conversación muestra "pensando" SOLO cuando esa conversación tiene un request en curso.
- Las respuestas siempre se guardan en la conversación correcta y solo se muestran en pantalla si esa conversación sigue activa (al cambiar y volver, se ven al recargar mensajes).
- El sidebar de conversaciones se puede plegar/desplegar en desktop, recordando la preferencia.

