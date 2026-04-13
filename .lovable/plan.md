

## Plan: Import project assets from ZIP into the application

### Step 1 — Extract and inspect ZIP contents
- Copy `Oportunidades.zip` to `/tmp/` and unzip it
- List all folders (each folder = one project/activo) and their contents (images, documents, data files)
- Determine the file types present (photos, PDFs, spreadsheets, etc.)

### Step 2 — Upload assets to Storage
- For each project folder, upload all files (images, documents) to the `documentos_contratos` storage bucket under a path like `oportunidades/{folder_name}/`
- Generate signed URLs or public URLs as needed

### Step 3 — Create or update database records
- For each folder, create a record in `proyectos` (oportunidad) with the folder name as `nombre`
- If the folder contains images, store the first one as a reference photo
- If the folder contains documents (PDFs, DOCX), insert rows into `documentos_proyecto` linking to the uploaded storage paths
- If any folder contains structured data (CSV, Excel), parse and populate relevant fields (ubicacion, presupuesto, etc.)

### Step 4 — Trigger RAG indexing
- For any uploaded documents, call `ingestDocument` to index them into the knowledge base

### Technical details
- File: `supabase/functions/generate-pdf/index.ts` — no changes needed
- Storage bucket: `documentos_contratos` (already exists)
- Tables affected: `proyectos` (insert), `documentos_proyecto` (insert), `activos` (optional insert)
- All operations done via a script in `/tmp/` using Supabase client with service role key

### What I need first
Before implementing, I need to extract the ZIP to see the exact folder structure and file types. This will happen as the first step after approval.

