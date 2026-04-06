

## Plan: PDF bajo demanda en AVA (no automático)

### Resumen
Quitar el botón "PDF" que aparece en cada mensaje del asistente. En su lugar, AVA debe ser capaz de generar un informe/documento PDF cuando el usuario se lo pida explícitamente en el chat (ej: "prepárame un informe de eso"). El flujo normal de preguntas se responde con texto markdown como siempre.

### Cambios

#### 1. `src/pages/AsistenteIA.tsx`
- Eliminar el botón `<Button>` con icono `FileDown` y texto "PDF" que aparece en cada mensaje assistant (línea 176-178)
- Eliminar la función `exportMessageToPdf` y la importación de `FileDown` (ya no se usan)

#### 2. `supabase/functions/ava-orchestrator/index.ts`
- Añadir una nueva tool `generate_pdf_report` al array de herramientas disponibles para el modelo
- Parámetros: `title` (string), `content` (string, markdown del informe)
- Cuando el usuario pida "hazme un informe", "genera un documento", etc., el modelo usará esta tool
- La respuesta del orchestrator incluirá un campo `pdf_content` en el meta cuando se use esta tool
- Actualizar el SYSTEM_PROMPT para indicar que cuando el usuario pida un informe o documento, debe usar `generate_pdf_report` estructurando el contenido como un documento profesional con secciones

#### 3. `src/pages/AsistenteIA.tsx` (renderizado condicional)
- Cuando un mensaje assistant tenga `meta.pdf_content`, mostrar un botón "Descargar informe PDF" solo en ese mensaje
- Al pulsar, se ejecuta la función `exportMessageToPdf` con el contenido estructurado del informe (no con la respuesta conversacional)

#### 4. `src/hooks/useChatMessages.ts`
- Ampliar el tipo `ChatMessage.meta` para incluir `pdf_content?: string` y `pdf_title?: string`
- Parsear estos campos de la respuesta del orchestrator cuando vengan

### Flujo resultante
1. Usuario pregunta algo → AVA responde en texto markdown (sin botón PDF)
2. Usuario dice "hazme un informe de eso" → AVA usa tool `generate_pdf_report`, estructura un documento profesional → se muestra la respuesta + botón "Descargar PDF" solo en ese mensaje

### Archivos afectados

| Archivo | Acción |
|---|---|
| `src/pages/AsistenteIA.tsx` | Quitar botón PDF de todos los mensajes, añadir botón condicional solo cuando hay `pdf_content` |
| `src/hooks/useChatMessages.ts` | Ampliar meta con `pdf_content` |
| `supabase/functions/ava-orchestrator/index.ts` | Nueva tool `generate_pdf_report` + instrucciones en system prompt |

