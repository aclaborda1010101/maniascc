

# Cerrar el bucle de aprendizaje continuo de AVA

## Diagnóstico (estado real, no aspiracional)

| Pieza | Estado |
|---|---|
| Captura de feedback (👍/👎/correcciones/aprobaciones de match) | ✅ Activa |
| Cola de tareas + agregador (`ai-learning-aggregator`) | ✅ 423 procesadas, 0 pendientes |
| Patrones consolidados (`ai_learned_patterns`) | ✅ 14 activos, sector/presupuesto/superficie + AVA |
| Inyección en `ava-orchestrator` | ✅ Top 30 patrones + 5 últimas correcciones cada turno |
| Inyección en `generate-match-v4` | ✅ Ajuste de score por patrones aprendidos |
| Filtrado de correcciones por **relevancia al tema actual** | ❌ Hoy se cargan globales |
| UI para auditar / desactivar / forzar lecciones | ❌ Solo lectura parcial en `/patrones` |
| Volumen real de feedback explícito en AVA chat | ⚠️ 1 solo voto histórico |

Conclusión: **el motor aprende**, pero la memoria conversacional es ciega al contexto y el usuario no tiene forma de ver ni corregir lo que la máquina cree haber aprendido.

## Cambios propuestos

### 1. Inyección de lecciones por relevancia (no global)
En `ava-orchestrator/index.ts`, antes de pegar el `lessonsBlock`:
- Inferir el tópico de la pregunta actual con la misma función `inferTopic` que ya usa el agregador.
- Cargar correcciones desde `ai_learned_patterns` (`patron_tipo='ava_correction'`) filtrando por `patron_key LIKE 'correction:<topic>:%'` además del fallback genérico.
- Priorizar patrones con `tasa_exito` extrema (muy alta o muy baja) sobre los neutros.

### 2. Página `/patrones` ampliada con sección "Memoria de AVA"
Añadir a `src/pages/Patrones.tsx` una pestaña nueva con:
- Tabla de **correcciones aprendidas** (`patron_tipo='ava_correction'`): tópico, descripción, fecha, número de aplicaciones, botón "Desactivar".
- Tabla de **tópicos** (`patron_tipo='ava_topic'`) con tasa de éxito y nº de votos.
- Botón "Marcar como obsoleto" → `UPDATE ai_learned_patterns SET activo=false WHERE id=...`.
- Filtro por tipo y por confianza.

### 3. Captura más visible en el chat
En `AvaMessageFeedback.tsx`:
- Mostrar los botones 👍/👎 ya visibles en cada respuesta (ya están), pero añadir un microcopy sutil al pasar el ratón: *"Tu voto entrena a AVA"*.
- Después de un 👎, abrir directamente el textarea de corrección (hoy hay que hacer un click extra).

### 4. Telemetría mínima de aprendizaje
Nueva tarjeta en `/patrones` con:
- Total de feedbacks últimos 30 días.
- Patrones nuevos creados.
- Patrones que han cambiado de signo (de éxito a fracaso o viceversa).
Lectura directa de `ai_learned_patterns` y `ai_feedback`, sin nuevas tablas.

## Lo que NO se toca

- Esquema de base de datos (las tres tablas son suficientes).
- `ai-learning-aggregator` (funciona y procesa todo lo encolado).
- `generate-match-v4` (ya consume patrones correctamente).
- Tono de AVA, prompts ni edge functions de RAG/PDF.

## Detalles técnicos

- Archivos a modificar: `supabase/functions/ava-orchestrator/index.ts`, `src/pages/Patrones.tsx`, `src/components/AvaMessageFeedback.tsx`.
- Función auxiliar `inferTopic` se duplica en el orquestador (ya existe en el aggregator) para evitar import cross-function.
- Sin nuevas migraciones: se usa el campo `activo` ya presente en `ai_learned_patterns`.
- El filtro por tópico se aplica como `OR` ampliado: `patron_key LIKE 'correction:${topic}:%' OR patron_tipo='ava_topic'`.
- `confianza ≥ 0.6` se mantiene como umbral por defecto; configurable desde la UI más adelante si hace falta.

## Resultado esperado

- AVA verá correcciones **sólo cuando vengan al caso**, no como ruido permanente.
- El usuario podrá auditar la memoria y desactivar lecciones equivocadas.
- Subirá el volumen de feedback útil (más fricción reducida = más votos).
- El bucle queda **observable y reversible**, no una caja negra.

