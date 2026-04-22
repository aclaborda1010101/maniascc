INSERT INTO public.rag_reprocess_queue (documento_id, task_type, estado, intentos)
SELECT DISTINCT c.documento_id, 'embed', 'pending', 0
  FROM public.document_chunks c
 WHERE c.embedding IS NULL
   AND c.documento_id IS NOT NULL
ON CONFLICT (documento_id, task_type) DO NOTHING;