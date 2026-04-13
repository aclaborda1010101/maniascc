

## Plan: Re-indexar los 81 documentos restantes

### Qué se hará
Ejecutar un script batch que:
1. Consulte `documentos_proyecto` donde `procesado_ia = false` para obtener los IDs pendientes
2. Llame a la edge function `rag-ingest` secuencialmente para cada documento, con un delay de 3 segundos entre llamadas para evitar rate limits
3. Reporte el progreso y resultado final (éxitos/fallos)

### Detalles técnicos
- Script Python en `/tmp/` que usa la API REST de Supabase directamente
- Autenticación con service role key para el listado, y token de usuario para las llamadas a la edge function
- Timeout generoso por documento (120s) ya que Gemini puede tardar en procesar archivos grandes
- Se mostrará progreso en tiempo real: `[12/81] ✓ Contrato_Rivas.pdf (8 chunks)`

### Archivo modificado
Ninguno — solo ejecución de script temporal

