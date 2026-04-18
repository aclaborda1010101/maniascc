

The user has 48k emails from one user but they contain valuable cross-project intelligence (operators, contacts, negotiations, assets) that should benefit the whole team. They want a hybrid: raw personal content stays private, but extracted entities/patterns/insights are shared.

This is the classic "knowledge extraction vs raw data" architectural question. Right answer:
- **Two layers**: raw chunks (private) + extracted entities/insights (shared)
- During ingestion, an LLM extracts structured knowledge from each email/thread:
  - Operators mentioned (linked to operadores table)
  - People mentioned (linked/created in contactos)
  - Negotiation signals (price discussions, conditions, dates)
  - Assets/projects mentioned
  - Sentiment, key facts, summary
- The raw chunks stay `visibility='private'` (only the owner sees them in RAG search)
- The extracted structured data goes to shared tables → all team sees it
- AVA + RAG-proxy gets enhanced: when querying about "Zara", it pulls shared insights from ALL users who emailed Zara, but only quotes raw text from chunks the asking user owns

This way the user keeps GDPR compliance + leverages the network effect.

Let me design concretely. The infra (owner_id + visibility) is already in place from previous migration. Now I need to add the knowledge extraction layer.

Keep plan tight.

## Plan: Capa de inteligencia compartida sobre RAG privado

### Estrategia híbrida (lo que recomiendo)

**Dos capas independientes** sobre los mismos correos:

| Capa | Contenido | Visibilidad | Uso |
|---|---|---|---|
| **Raw chunks** (`document_chunks`) | Texto literal de correos/adjuntos | `private` (solo el dueño) | RAG textual cuando el dueño consulta |
| **Knowledge graph** (nuevas tablas) | Entidades extraídas, hechos, señales | `shared` (todo el equipo) | Inteligencia colectiva de AVA |

Así el correo personal nunca se filtra textualmente, pero el conocimiento útil sí circula.

### Nuevas tablas (compartidas por defecto)

1. **`email_threads`** — Un hilo de correo agregado (no cada mensaje)
   - `id`, `owner_id`, `subject`, `participants[]`, `first_date`, `last_date`, `message_count`, `summary` (LLM), `key_topics[]`, `visibility='shared'`
   - Solo metadatos + resumen IA, no contenido literal

2. **`email_entities`** — Entidades detectadas en cada hilo
   - `thread_id`, `entity_type` (`operador`|`contacto`|`activo`|`proyecto`), `entity_id` (FK opcional), `entity_name_raw`, `mention_count`, `confidence`
   - Permite preguntar "¿quién ha hablado con Zara?" → aparece todo el equipo

3. **`negotiation_signals`** — Señales extraídas (precio mencionado, condiciones, deadlines)
   - `thread_id`, `signal_type`, `value`, `context_snippet` (solo 1 frase, no más), `extracted_at`
   - Sirve a AVA y al sistema de patrones

4. **`contact_interactions`** — Quién habló con quién, cuántas veces, último contacto
   - `contact_email`, `owner_id`, `thread_count`, `last_interaction`, `sentiment_avg`, `visibility='shared'`
   - Red de relaciones del equipo

### Pipeline de ingesta de correos (nueva edge function `email-bulk-ingest`)

```
.mbox/.pst/IMAP → parser → agrupar por thread_id
  ↓
Para cada hilo (lotes de 50):
  ├─ Subir archivo a Storage (private, owner=user)
  ├─ Crear documento_proyecto (visibility=private, owner_id=user)
  ├─ Chunks del texto crudo → document_chunks (visibility=private)
  └─ LLM extracción estructurada (gemini-2.5-flash):
       ├─ resumen → email_threads (shared)
       ├─ entidades → email_entities (shared, link a operadores/contactos)
       ├─ señales negociación → negotiation_signals (shared)
       └─ stats interlocutor → contact_interactions (shared, upsert)
```

Costo estimado: ~$0.0003/hilo × ~8.000 hilos ≈ $2-3 total para 48k correos.

### AVA + RAG modificado

`rag-proxy-v4` se actualiza para devolver dos fuentes:

1. **Privado**: chunks del propio usuario (texto literal con citas)
2. **Compartido**: hits en `email_threads` + `email_entities` + `negotiation_signals` (resúmenes y señales, no texto literal)

Ejemplo: usuario pregunta "¿qué sabemos de Zara?"
- AVA muestra: "El equipo tiene 47 hilos con Zara (Pedro: 30, Carlos: 17). Última interacción: hace 12 días. Señales recientes: piden 800m² zona prime, presupuesto €25k/mes, mencionaron Inditex consolidación. *(Tus 30 hilos: enlazar al detalle.)*"

### Control del usuario

En **Ajustes → Privacidad**:
- Toggle global "Permitir extracción de inteligencia compartida de mis correos" (default ON, recomendado)
- Lista de dominios excluidos (ej: `@gmail.com`, asuntos con "personal")
- Botón "Borrar todas mis extracciones" (GDPR)

### Adjuntos (los 100k)

- Deduplicación por hash MD5 (esperable ~30-40% duplicados)
- Solo se indexan adjuntos relevantes: PDFs/DOCXs/XLSXs (PPTX y planos a Storage sin indexar de momento)
- Imágenes solo metadatos (nombre + EXIF)

### Archivos a crear/modificar

| Archivo | Cambio |
|---|---|
| `supabase/migrations/` (nueva) | Crear `email_threads`, `email_entities`, `negotiation_signals`, `contact_interactions` con RLS |
| `supabase/functions/email-bulk-ingest/index.ts` (nuevo) | Pipeline batch correos + extracción IA |
| `supabase/functions/rag-proxy-v4/index.ts` | Devolver dos capas (privado + compartido) |
| `supabase/functions/ava-orchestrator/index.ts` | Nueva tool `team_knowledge_search` que consulta tablas compartidas |
| `src/components/contactos/ImportContactosModal.tsx` | Nueva pestaña "Importar correos masivos" (.mbox/.pst) con barra de progreso |
| `src/pages/Ajustes.tsx` | Pestaña "Privacidad" con toggle de extracción + dominios excluidos |
| `src/pages/Contactos.tsx` | Mostrar `contact_interactions` agregadas (badge "El equipo: X interacciones") |

### Decisión rápida que necesito de ti

¿En qué formato vas a darme los 48k correos para empezar?
- **A)** Archivo `.mbox` exportado de Gmail/Thunderbird (más fácil de procesar)
- **B)** `.pst` de Outlook (requiere conversión previa, te indico cómo)
- **C)** Conexión IMAP en vivo (más lento pero sincronizable)
- **D)** Dump CSV con campos `from, to, date, subject, body, attachments`

Cuando confirmes el formato, implemento la migración + edge function + UI en una sola tanda.

