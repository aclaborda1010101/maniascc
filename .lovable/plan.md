

# Diagnóstico: lentitud generalizada (AVA, Oportunidades, Activos, Dashboard)

## Causa real

Las peticiones a Supabase REST están devolviendo **503 PGRST002** repetidamente:

```
Could not query the database for the schema cache. Retrying.
```

Esto ocurre cuando **PostgREST no puede mantener el caché del schema**, típicamente porque:

1. La instancia de Lovable Cloud está **saturada de CPU / memoria** (ahora mismo tienes ~40.000 documentos, 315.000 chunks, embeddings recién activados, RAG batch corriendo, AVA, Realtime…).
2. Hay **demasiadas conexiones concurrentes** abiertas contra Postgres (cada pestaña de tu app abre varias).
3. Acabamos de aplicar **2 migraciones grandes** (pgvector + columna `embedding vector(1536)` + funciones RPC) que invalidan el schema cache y obligan a PostgREST a reconstruirlo bajo carga.

Por eso:
- AVA no carga conversaciones → `GET ava_conversations` → 503
- Oportunidades tarda → `GET proyectos` → 503 con reintentos
- Activos tarda → `GET activos` → 503
- Dashboard tarda → varias queries paralelas → todas en 503

No es un bug de código. El front está bien; el backend no responde a tiempo.

## Plan de acción (3 frentes en paralelo)

### 1) Inmediato — reducir presión sobre la BD

- **Pausar el batch RAG** (clasificación + embeddings) si está corriendo ahora mismo. Comprobar `rag_reprocess_queue` y poner en `paused` los pendientes hasta que la BD recupere el cache.
- **Forzar refresh del schema cache** ejecutando `NOTIFY pgrst, 'reload schema';` desde una migración corta. Esto suele desbloquear los 503 en segundos.
- **Reducir polling**: la AppLayout/Notification Center y `useChatMessages` mantienen suscripciones realtime que abren websockets — revisar que se desconectan al desmontar.

### 2) Corto plazo — código que reduce carga

- **`ava_conversations`**: añadir `.limit(30)` y seleccionar columnas concretas (hoy `select=*`).
- **Activos / Operadores / Contactos**: aplicar el mismo patrón que ya hicimos en Proyectos (`limit(60)` + columnas explícitas + debounce 350 ms en search).
- **Dashboard**: las KPIs hacen `count('*', {head:true})` sobre tablas grandes; reemplazar por un único RPC `dashboard_stats()` que devuelva todos los contadores en una sola query (evita 6 round-trips).
- **AppLayout `<FloatingChat />`**: el hook `useChatMessages` arranca aunque el panel esté cerrado. Cargarlo perezosamente solo cuando el usuario abre el FAB.

### 3) Plataforma — cuando lo anterior no basta

Si tras las optimizaciones siguen apareciendo 503 esporádicos bajo uso normal, la instancia de Lovable Cloud se ha quedado pequeña para tu volumen (40k docs + RAG vectorial + AVA concurrente).

Puedes ampliar la capacidad desde:
**Backend → Lovable Cloud → Advanced settings → Upgrade instance**
([docs](https://docs.lovable.dev/features/cloud#advanced-settings-upgrade-instance))

Mi recomendación: aplicar 1 y 2 primero, observar 24 h, y solo escalar si reaparece.

## Detalles técnicos

- Migración para forzar reload del schema cache de PostgREST (1 línea).
- RPC `dashboard_stats()` agregando: oportunidades activas, operadores, activos, docs, costes IA del mes — todo en un solo SELECT.
- Refactor de `Activos.tsx`, `Operadores.tsx`, `Contactos.tsx` (mismo patrón debounce + limit + columnas).
- Refactor de `useChatMessages.ts`: lazy-init (no consultar `ava_conversations` hasta que `open=true` en `FloatingChat`).
- Pausar/auditar `rag_reprocess_queue`: `UPDATE rag_reprocess_queue SET status='paused' WHERE status='pending'` + botón "Reanudar" en `/admin`.

## Resultado esperado

- Desaparición de los 503 en cuestión de segundos tras el `NOTIFY`.
- Carga inicial de AVA, Activos y Oportunidades **<1 s** en lugar de varios segundos.
- Dashboard: 1 query en lugar de 6 — carga instantánea.
- Si vuelve la lentitud bajo carga real → escalar instancia (paso 3).

