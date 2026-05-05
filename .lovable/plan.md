He revisado el estado real de la base de datos ahora mismo. La cifra interna ya no cuadra con el aviso de “97%”.

Datos actuales comprobados:

```text
Tamaño real de base de datos: 8.48 GB
Tablespace principal:         8.50 GB
WAL / registros internos:     2.00 GB aprox.
Total estimado real:          ~10.5 GB + overhead
```

Es decir: después de eliminar la tabla legacy, la base ya está muy por debajo del escenario crítico. El aviso que ves parece ser una métrica cacheada/desfasada de Lovable Cloud, no el estado real actual de los datos.

También he detectado dos cosas relevantes:

```text
document_chunks        ~7.56 GB   Activo, NO tocar ahora: es el RAG principal.
cron.job_run_details   ~762 MB    Historial técnico de tareas automáticas, se puede limpiar.
```

## Plan propuesto

1. Esperar/forzar refresco de métricas de Cloud
   - Recargar la vista de Cloud → Advanced Settings.
   - Si el panel sigue mostrando 97%, esperar algo más porque las métricas de infraestructura pueden tardar más que las métricas SQL internas.
   - La base ya marca 8.48 GB, por lo que no parece haber riesgo inmediato real.

2. Hacer una limpieza segura adicional del historial técnico
   - Limpiar `cron.job_run_details`, que ocupa ~762 MB y solo contiene historial de ejecuciones automáticas.
   - Mantener, como máximo, los registros recientes necesarios para diagnóstico.
   - Esto no afecta a documentos, RAG, usuarios, AVA ni memoria de usuario.

3. Revisar el job de email que corre cada 5 segundos
   - Hay una tarea automática de cola de emails ejecutándose cada 5 segundos.
   - Eso genera muchísimo historial técnico aunque no haya actividad real.
   - Ajustaría su frecuencia a algo menos agresivo, por ejemplo cada 30 o 60 segundos, si no hay una razón crítica para mantener 5 segundos.

4. No tocar `document_chunks` en esta fase
   - Es la fuente activa del RAG.
   - Reducirla requiere una fase aparte: deduplicación, archivado o reindexado selectivo.
   - Ahora mismo no lo recomiendo porque el problema aparente ya no viene de ahí, sino del aviso desfasado y algo de historial técnico acumulado.

## Resultado esperado

Después de aprobar este plan, ejecutaré una limpieza conservadora del historial técnico y revisaré la programación del job repetitivo. Eso debería reducir algo más el uso real y ayudar a que Lovable Cloud deje de marcar la instancia como crítica cuando sus métricas se actualicen.

Si después de eso el panel siguiera mostrando 97%, ya no sería un problema de datos de la app, sino de refresco/estado de la métrica de Cloud, y habría que tratarlo como incidencia de la plataforma desde Advanced Settings.