He revisado el estado real de la base y el aviso sigue teniendo sentido: aunque has ampliado capacidad, el backend todavía tiene un volumen de datos RAG desproporcionado. La nueva memoria de AVA no es el problema.

Diagnóstico actual:

```text
Tamaño total DB: ~12 GB

public.document_chunks       ~7.6 GB
  - tabla:   ~2.1 GB
  - índices: ~3.2 GB
  - índice HNSW embeddings: ~2.5 GB
  - filas: ~565k chunks, todos con embedding

public.document_embeddings   ~3.5 GB
  - tabla legacy JSONB de embeddings
  - filas: ~465k
  - no aparece usada por frontend ni funciones actuales

Resto de tablas: marginal frente a RAG
```

Conclusión: el aviso no viene del deploy de memoria, sino de que el sistema conserva dos capas de embeddings: la actual (`document_chunks.embedding`, usada por `rag-proxy`) y una tabla legacy (`document_embeddings`) que aparentemente ya no usa la app. Además, `document_chunks` tiene un índice vectorial HNSW grande, esperable para 565k embeddings.

Plan propuesto para quitar el aviso de raíz sin romper AVA/RAG:

1. Confirmar dependencia cero de `document_embeddings`
   - Verificar en código y base que ninguna función activa consulta `document_embeddings`.
   - Ya hay indicio fuerte: búsquedas en `src/` y `supabase/functions/` solo muestran referencias reales a `document_chunks`; `document_embeddings` aparece principalmente en migraciones/types.

2. Crear migración segura de limpieza legacy
   - Eliminar la tabla legacy `public.document_embeddings` si se confirma que no está en uso.
   - Esto debería liberar aproximadamente 3.5 GB.
   - No tocar `document_chunks`, porque es la fuente activa del RAG híbrido.

3. Añadir mantenimiento preventivo de cache/query embeddings
   - Mantener `query_embeddings_cache` pequeño usando la función existente de limpieza de expirados.
   - Si procede, añadir/ajustar una política de retención en tablas auxiliares pequeñas, sin afectar conocimiento activo.

4. Diagnóstico posterior a la migración
   - Recalcular tamaños por tabla.
   - Confirmar que `document_chunks` sigue intacta y con embeddings.
   - Validar una consulta RAG/AVA normal contra `rag-proxy`/`ava-orchestrator` para asegurar que la búsqueda documental sigue funcionando.

5. Si el aviso persiste tras liberar legacy
   - El siguiente foco será reducir `document_chunks` sin perder calidad: deduplicación por `documento_id + chunk_index/contenido`, eliminación de documentos duplicados, o estrategia de archivado por dominios/proyectos.
   - Esto lo dejaría como segunda fase, porque sí puede afectar cobertura RAG si se hace sin auditoría.

Cambios previstos:

```text
Migrations:
- drop seguro de public.document_embeddings tras validación final

No se prevén cambios frontend.
No se prevén cambios en ava-orchestrator.
No se toca document_chunks ni su índice HNSW en esta fase.
```

Riesgo: bajo si `document_embeddings` está efectivamente obsoleta. Beneficio: liberar una parte grande del disco y reducir presión de recursos sin degradar el RAG actual.