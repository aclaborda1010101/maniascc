## Memoria global persistente de AVA (`ava_user_memory`)

Implementación completa de los 3 puntos pendientes ya aprobados, más nota sobre lo que ocupa disco.

---

### Diagnóstico de disco (informativo)

Top tablas:
```text
document_chunks       7565 MB
document_embeddings   3515 MB
documentos_proyecto     97 MB
document_links          31 MB
contactos              7.7 MB
ava_messages           448 KB
```

El RAG ocupa ~11 GB de los ~14 GB. La nueva tabla de memoria es despreciable (texto plano, ~30 filas/usuario). No mueve la aguja. Más adelante propondré un plan de limpieza separado (chunks/embeddings huérfanos de documentos borrados, deduplicación). No se toca en este deploy.

---

### 1. Migración SQL (`supabase/migrations/20260505120000_ava_user_memory.sql`)

```sql
create table public.ava_user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  category text,
  source text not null default 'user_explicit'
    check (source in ('user_explicit', 'ai_inferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (user_id, key)
);

create index idx_ava_user_memory_user_recent
  on public.ava_user_memory (user_id, last_used_at desc);

create trigger trg_ava_user_memory_updated_at
  before update on public.ava_user_memory
  for each row execute function public.update_updated_at_column();

alter table public.ava_user_memory enable row level security;

-- 4 políticas (select/insert/update/delete) restringidas a auth.uid() = user_id
```

---

### 2. Cambios en `supabase/functions/ava-orchestrator/index.ts`

**a) Helper `loadUserMemory(admin, userId)`** (nuevo, después de `isAbortTimeoutError`):
- Carga top 30 hechos por `last_used_at desc`.
- Fire-and-forget UPDATE de `last_used_at` con cliente admin (no bloquea).
- Fallback silencioso si la tabla no existe aún (evita romper en el primer deploy).

**b) `formatUserMemoryBlock(facts)`**: genera el bloque `## SOBRE EL USUARIO` agrupado por `category`. Si está vacío, inyecta una nota corta animando a AVA a proponer guardar hechos repetidos.

**c) Bloque `USER_MEMORY_RULES`** (constante de texto): se concatena al `SYSTEM_PROMPT`. Reglas explícitas:
- `source: "user_explicit"` ("recuerda que…", "siempre prefiero…", correcciones) → guardar directamente.
- `source: "ai_inferred"` (detección de dato repetido 3+ veces) → preguntar antes.
- Lista negra: datos puntuales, información volátil, sensibles no solicitados.
- Formato de `key`: snake_case semántico.

**d) Dos tools nuevas en `TOOLS`** (después de `add_entity_narrative`):

```ts
{ name: "remember_fact",
  parameters: { key, value, category?, source: "user_explicit" | "ai_inferred" } }

{ name: "forget_fact",
  parameters: { key } }
```

**e) Dos branches nuevos en el dispatcher** (después del branch `add_entity_narrative` ~línea 981):
- `remember_fact`: `admin.from("ava_user_memory").upsert({ user_id, key, value, category, source }, { onConflict: "user_id,key" })`. Devuelve `{ saved: true, key }`.
- `forget_fact`: `admin.from("ava_user_memory").delete().eq("user_id", userId).eq("key", key)`. Devuelve `{ deleted: true, key }`.

**f) Inyección del bloque de memoria en los DOS system prompts:**
- Línea 730 (primera llamada con tools): `SYSTEM_PROMPT + USER_MEMORY_RULES + userMemoryBlock + lessonsBlock + attachmentsBlock + domainFilterBlock`
- Línea 1263 (síntesis): mismo patrón.
- La carga (`loadUserMemory`) ocurre una vez por request, ANTES del primer `serve` block que construye `messages`, en paralelo con la carga de patterns.

**g) Fast-path (small-talk) NO toca la memoria** — sigue ~600ms. La rama `if (isSmallTalk(...))` no se modifica.

---

### 3. UI: sección "Memoria de AVA" en `Ajustes.tsx`

Hay un componente existente `src/components/MemoriaAvaPanel.tsx` que muestra **patrones aprendidos** del feedback loop (otra cosa). Para no mezclar conceptos:

- Crear nuevo componente `src/components/MemoriaUsuarioPanel.tsx` con:
  - Lista de hechos (`key`, `value`, `category`, `source` como chip, `last_used_at`).
  - Botón "Eliminar" por fila → DELETE individual.
  - Botón "Borrar toda mi memoria" arriba con confirmación.
  - Empty state explicando qué es y cómo se rellena.
  - Lectura/escritura directa con `supabase.from("ava_user_memory")` (RLS hace el resto).

- En `src/pages/Ajustes.tsx`: añadir un quinto tab `"memoria"` con icono `Brain` que renderiza `<MemoriaUsuarioPanel />`.

---

### 4. Plan de prueba (post-deploy)

1. `"hola"` → fast-path ~600ms, **sin** carga de memoria (verificar en logs que no aparece `## SOBRE EL USUARIO`).
2. `"qué proyectos tengo activos"` → ruta normal, en logs aparece bloque `## SOBRE EL USUARIO` (vacío al principio).
3. `"recuerda que trabajo habitualmente con Burger King"` → AVA llama `remember_fact` directamente con `source: "user_explicit"`. Verificar fila en `ava_user_memory`.
4. Mencionar "Mercadona" en 3 consultas distintas → AVA pregunta "¿Quieres que recuerde que trabajas con Mercadona?". Solo si dices sí, guarda con `source: "ai_inferred"`.
5. Abrir Ajustes → tab "Memoria" → verificar que aparecen los hechos, eliminar uno y confirmar que desaparece.

---

### Notas técnicas

- Tabla con RLS estricta (`auth.uid() = user_id`), nada de roles.
- Trigger `update_updated_at_column` reusado (ya existe en el proyecto).
- `unique(user_id, key)` permite el upsert idempotente.
- `last_used_at` es la métrica de relevancia para el top 30 (no `updated_at`), así los hechos que AVA realmente usa permanecen arriba.
- Cliente admin (service_role) para el UPDATE de `last_used_at` para no depender de la sesión del usuario en background tasks.