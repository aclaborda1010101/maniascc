

## Diagnóstico del problema de autoaprendizaje

He auditado el sistema y hay **3 fallos graves que rompen el ciclo de aprendizaje**:

### 1. Las 412 tareas de aprendizaje nunca se ejecutan ❌
- `ai_feedback` tiene **412 registros**.
- `ai_agent_tasks` tiene **412 tareas pending** del agregador.
- `ai_learned_patterns` tiene **0 filas**.

Causa: nadie invoca `ai-learning-aggregator`. No hay cron, no hay trigger, no hay llamada desde cliente. La función existe pero está huérfana.

### 2. AVA chat no captura feedback (ni explícito ni implícito)
- `FeedbackWidget` solo está en `MatchCard`, `ProyectoRAG` y `ProyectoInsights`.
- En `AsistenteIA.tsx` y `FloatingChat.tsx` **no hay forma de marcar 👍/👎** una respuesta.
- Las correcciones del usuario en lenguaje natural ("te has olvidado de Rivas Centro", "no hay superficie para Obramat") se pierden: no se detectan como señal negativa.

### 3. AVA orquestador no usa los patrones aprendidos
- `ava-orchestrator/index.ts` solo lista `ai_feedback` como tabla consultable, pero **nunca inyecta `ai_learned_patterns` en el system prompt**. Aunque el agregador funcionara, AVA no se enteraría.

---

## Plan de solución

### A. Disparar el agregador automáticamente
**`supabase/functions/ai-learning-aggregator/index.ts`** + **nueva migración**:
- Programar `pg_cron` cada 5 minutos para invocar la función vía `net.http_post` (o llamar directamente desde el cliente tras registrar feedback). Opción más simple y robusta: añadir invocación inmediata desde `triggerPatternLearning` en `feedbackService.ts` con `supabase.functions.invoke('ai-learning-aggregator')` (fire-and-forget) además de mantener la tarea en cola.
- Procesar también las **412 tareas atrasadas** (ya entran en el flujo en cuanto se invoque la función).
- Soportar `entidad_tipo: 'ava_message'` en el aggregator (hoy solo procesa `match` y `rag_response`).

### B. Capturar feedback en AVA chat
**`src/components/AvaMessageFeedback.tsx`** (nuevo, derivado de FeedbackWidget pero adaptado):
- Botones 👍 / 👎 / corregir bajo cada respuesta del asistente en `AsistenteIA.tsx` y `FloatingChat.tsx`.
- `entidadTipo: 'ava_message'`, `entidadId: <ava_messages.id>` (ya devuelto por `insertedMsg`).
- En `useChatMessages.ts`: detectar **señales implícitas de corrección** en el siguiente mensaje del usuario (regex sobre patrones tipo "te has olvidado", "no es correcto", "está mal", "no hay", "revisa", "corrige") y registrar `feedback_tipo: 'thumbs_down'` automáticamente sobre el mensaje anterior del asistente, con el texto de corrección en `correccion_sugerida`.

### C. Que AVA use lo aprendido
**`supabase/functions/ava-orchestrator/index.ts`**:
- Antes de la primera llamada IA, hacer SELECT de `ai_learned_patterns WHERE activo AND confianza >= 0.6 ORDER BY num_observaciones DESC LIMIT 30`.
- Inyectar bloque `## LECCIONES APRENDIDAS` al final de `SYSTEM_PROMPT` con cada patrón formateado (`patron_descripcion` + tasa de éxito + nota si es positivo/negativo).
- También inyectar las últimas **5 correcciones explícitas** del usuario sobre mensajes AVA (de `ai_feedback` con `correccion_sugerida IS NOT NULL`) como ejemplos concretos a evitar/replicar.

### D. Extender el aggregator a `ava_message`
- Nueva función `processAvaMessageFeedback()` que registra patrones tipo `ava_topic:<tema_inferido>` y `ava_correction:<keyword>` con score negativo si hubo corrección.
- Tema inferido a partir de `contexto.tools_used` o primeras palabras del mensaje original.

---

## Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| `src/services/feedbackService.ts` | Añadir `'ava_message'` al `EntityType`. Llamar a `supabase.functions.invoke('ai-learning-aggregator')` tras encolar tarea. |
| `src/hooks/useChatMessages.ts` | Detectar correcciones implícitas en siguiente input del usuario y registrar feedback negativo sobre el último msg del asistente. |
| `src/pages/AsistenteIA.tsx` | Renderizar `<FeedbackWidget entidadTipo="ava_message" entidadId={msg.id} />` bajo cada respuesta del asistente. |
| `src/components/FloatingChat.tsx` | Mismo widget. |
| `supabase/functions/ai-learning-aggregator/index.ts` | Soportar `entidad_tipo='ava_message'`, procesar lote más grande, no exigir 10 tareas para `aggregateMatchPatterns`. |
| `supabase/functions/ava-orchestrator/index.ts` | Cargar patrones e inyectarlos en el system prompt antes de cada llamada IA. |
| Nueva migración SQL | (Opcional) `pg_cron` cada 5 min como red de seguridad. |

---

## Resultado esperado

- Cuando el usuario corrige a AVA ("te olvidaste de Rivas Centro", "no hay SBA para Obramat"), esa corrección queda registrada como **patrón negativo** asociado al tema, con confianza creciente cada vez que se repita.
- En la siguiente consulta similar, AVA recibe en su prompt: *"PATRÓN APRENDIDO: para análisis comerciales en Arganda incluir SIEMPRE Rivas Centro. No proponer Obramat por falta de SBA. (5 correcciones, confianza 0.75)"*.
- 👍 explícitos refuerzan el patrón positivo del enfoque usado (herramientas + tipo de respuesta).
- Las 412 tareas pendientes se procesarán en el primer disparo y empezarán a generar patrones de matches inmediatamente.

