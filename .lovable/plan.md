

El usuario pregunta dos cosas concretas, no pide implementación todavía. Es una consulta de investigación/decisión técnica. Aun así conviene presentar un mini-plan porque la respuesta implica decisiones que cambiarán código (qué proveedor usar para STT y para Realtime).

## Resumen de la pregunta
1. ¿Es mejor el tiempo real con OpenAI Realtime que con lo que tenemos (Gemini TTS browser)?
2. ¿Cuál es más rápido para transcripción: Groq, OpenAI Whisper o Gemini?

## Análisis

### Tiempo real (conversación bidireccional con voz)

| Opción | Latencia | Calidad voz | Interrupciones | Coste | Setup |
|---|---|---|---|---|---|
| **OpenAI Realtime API (gpt-realtime / gpt-4o-realtime)** | 300–800 ms voz→voz | Muy natural, prosodia humana | Sí, nativo (VAD server-side) | ~$0.06/min in + $0.24/min out audio | Requiere `OPENAI_API_KEY`, WebRTC + token efímero |
| **Lo actual (Gemini transcribe + SpeechSynthesis browser)** | 2–4 s por turno | Voz robótica del navegador | No, turnos rígidos | Solo coste Gemini | Ya funciona, sin keys extra |
| **Gemini Live API (2.5 Flash Live)** | ~500–900 ms | Buena, menos natural que OpenAI | Sí | Incluido en Lovable AI Gateway si se expone | Aún no expuesto en Lovable AI Gateway de forma estable |

**Conclusión**: Sí, OpenAI Realtime es claramente superior para conversación fluida tipo "llamada". Lo que tienes ahora es un loop por turnos, no tiempo real de verdad. Merece la pena para el modo "📞 conversación".

### Transcripción (STT puro, dictado)

Benchmarks públicos recientes (2025) y mi experiencia:

| Proveedor | Modelo | Latencia típica (audio 10s) | WER español | Coste |
|---|---|---|---|---|
| **Groq** | `whisper-large-v3-turbo` | **~0.3–0.6 s** ⚡ (hasta 200x realtime) | ~5% | $0.04/h |
| **OpenAI** | `gpt-4o-transcribe` / `whisper-1` | ~1.5–3 s | ~4–5% | $0.006/min ($0.36/h) |
| **Gemini** (lo actual) | `gemini-2.5-flash` multimodal | ~2–4 s | ~6–8% (no es STT dedicado) | Incluido Lovable AI |

**Conclusión**: **Groq Whisper Large v3 Turbo** es el ganador absoluto en velocidad (5–10x más rápido que OpenAI, ~10x más rápido que Gemini) y además el más barato. Calidad muy similar a OpenAI Whisper. Gemini es el más lento porque no es un modelo STT dedicado, es un multimodal genérico.

## Recomendación

- **Dictado (STT)**: cambiar `ava-transcribe` para usar **Groq Whisper Large v3 Turbo** → respuesta casi instantánea. Necesita `GROQ_API_KEY` (gratis tier generoso, plan pago barato).
- **Conversación tiempo real**: usar **OpenAI Realtime API** (modelo `gpt-realtime` o `gpt-4o-realtime-preview`) con WebRTC + token efímero. Necesita `OPENAI_API_KEY`.
- Mantener Gemini sólo como fallback si las dos keys no están.

## Plan de implementación (cuando apruebes)

1. **Pedir secrets**: `GROQ_API_KEY` y `OPENAI_API_KEY` (en mensajes separados, una vez confirmes).
2. **Migrar `ava-transcribe`** a Groq:
   - Endpoint `https://api.groq.com/openai/v1/audio/transcriptions`
   - Modelo `whisper-large-v3-turbo`, `language: "es"`, `response_format: "json"`
   - Fallback a Gemini si Groq falla / no hay key.
3. **Crear `realtime-token`** edge function que emita tokens efímeros de OpenAI Realtime (`POST https://api.openai.com/v1/realtime/sessions`).
4. **Crear `AvaRealtimeOverlay.tsx`**: overlay full-screen estilo "llamada" con WebRTC peer connection a OpenAI, visualizador de onda, botón colgar. Sustituye al modo conversación actual cuando OPENAI_API_KEY esté configurada.
5. **Mantener el modo conversación actual** (Gemini + browser TTS) como fallback si OpenAI no está disponible.
6. **Botón "📞 Llamar a AVA"** en `AsistenteIA` y `FloatingChat` para abrir el overlay realtime. El botón mic actual queda para dictado puntual con Groq.

## Lo que NO cambia
- Toda la lógica de tools, attachments, Forge, CRUD confirmación → intacta.
- El orquestador AVA sigue siendo el mismo (recibe el texto transcrito por Groq o el texto de la sesión Realtime al final del turno).

## Preguntas antes de programar

¿Quieres las dos cosas (Groq + OpenAI Realtime) o solo migrar transcripción a Groq de momento y dejar OpenAI Realtime para más adelante?

