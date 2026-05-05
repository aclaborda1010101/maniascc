He confirmado que los buckets existen y que los ficheros están intactos: hay 4 buckets (`ava_attachments`, `documentos_contratos`, `documentos_generados`, `multimedia_locales`) con unos 130 MB en total. El fallo no parece ser pérdida de datos.

El punto sospechoso es que `storage.buckets` tiene RLS activado pero no tiene ninguna política de lectura sobre buckets. Eso puede hacer que el panel de Storage no consiga listar los buckets aunque `storage.objects` sí tenga políticas para los archivos.

Plan de corrección:

1. Añadir una migración segura para permitir listar buckets
   - Crear políticas de `SELECT` sobre `storage.buckets` para usuarios autenticados.
   - Mantener los buckets privados como privados; esto solo permite ver la lista/metadatos de buckets, no leer archivos privados.
   - No tocar datos ni borrar archivos.

2. Verificar políticas existentes de archivos
   - Mantener las políticas actuales de `storage.objects` por bucket.
   - Revisar si hay duplicados inofensivos, por ejemplo en `multimedia_locales`, pero no hacer limpieza agresiva salvo que sea necesario.

3. Probar desde SQL que el estado queda coherente
   - Confirmar que `storage.buckets` tiene políticas de lectura.
   - Confirmar que siguen existiendo los 4 buckets y sus objetos.

4. Indicaciones posteriores
   - Después de aplicar la migración, recargar Cloud → Storage y pulsar “Try again”.
   - Si el panel aún falla, el siguiente diagnóstico sería ya de plataforma/Cloud UI, porque la base de datos y las políticas quedarían correctas.

Resultado esperado:
- El panel Storage debería dejar de mostrar “Error loading buckets”.
- No cambia la privacidad de los documentos ni de los adjuntos.
- No afecta al RAG ni al almacenamiento real de la app.