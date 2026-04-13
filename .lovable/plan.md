

## Plan: Implementar memoria acumulativa en AVA para eliminar pérdida de contexto

### El problema demostrado

La conversación que adjuntas lo demuestra perfectamente: AVA propone KFC cuando ya le dijiste que hay uno enfrente, olvida el gimnasio, vuelve a proponer Obramat tras decirle que no hay superficie. Esto ocurre porque **solo se envían los últimos 10 mensajes** al modelo (truncado tanto en cliente como en servidor). En una conversación larga, los datos críticos de los primeros turnos desaparecen.

### Solución: Resumen progresivo + ventana ampliada

#### 1. Cliente (`src/hooks/useChatMessages.ts`, línea 284)
- Cambiar `slice(-10)` a `slice(-20)` para enviar más historial al servidor
- El servidor se encargará de la compresión inteligente

#### 2. Servidor (`supabase/functions/ava-orchestrator/index.ts`)

**Nueva función `summarizeOlderHistory()`** (antes de la primera llamada AI):
- Si el historial tiene más de 12 mensajes, tomar los mensajes antiguos (todos menos los últimos 6)
- Hacer una llamada rápida a Gemini Flash (`google/gemini-2.5-flash-lite`, coste ~€0.0001) con prompt: "Resume los hechos clave, restricciones y decisiones establecidas en esta conversación. Lista cada dato como un bullet point. No omitas ninguna restricción mencionada por el usuario."
- Inyectar el resumen como un mensaje de sistema adicional: `"CONTEXTO ACUMULADO DE LA CONVERSACIÓN (hechos establecidos que NO debes contradecir): [resumen]"`

**Cambios en la construcción de mensajes** (líneas 273-283):
```
Si history > 12 mensajes:
  [system prompt]
  [system: resumen acumulado de msgs 1..N-6]
  [últimos 6 mensajes completos]
  [mensaje actual]
Sino:
  [system prompt]
  [todos los mensajes del historial]
  [mensaje actual]
```

**Mismo cambio en la síntesis** (línea 579-588): incluir el resumen acumulado en `synthesisMessages`

#### 3. Retry en síntesis vacía (líneas 606-622)
- Si la síntesis devuelve vacío, reintentar una vez con prompt simplificado antes de usar el fallback genérico
- Esto elimina el "He procesado tu solicitud pero no pude formular una respuesta"

### Impacto en costes
- La llamada de resumen con Flash Lite cuesta ~€0.0001 (negligible)
- Solo se activa cuando hay más de 12 mensajes en el historial
- Resultado: AVA nunca más olvidará que hay un KFC enfrente, que ya hay gimnasio, o que no hay superficie para Obramat

### Archivos a modificar
- `src/hooks/useChatMessages.ts` — ampliar ventana de historial a 20
- `supabase/functions/ava-orchestrator/index.ts` — añadir función de resumen, inyectar contexto acumulado, retry en síntesis

