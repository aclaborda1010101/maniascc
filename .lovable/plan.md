
El usuario quiere transformar el Generador de Documentos (FORGE) para que produzca documentos verdaderamente profesionales — no markdown plano renderizado a PDF como ahora, sino plantillas con identidad visual fuerte, layout editorial, portada, índice, gráficos donde proceda, y maquetación de consultoría real.

## Estado actual (revisado)

- `generate-pdf` ya existe y usa `html2pdf.app` con un template HTML que tiene portada + TOC + estilos navy/gold McKinsey. Es decente pero genérico para todos los modos.
- `ai-forge` genera markdown plano con prompts cortos (10-15 líneas por modo). Modelo: `gemini-3-flash-preview`. Sin estructura JSON, sin secciones tipadas.
- `pdfService.ts` empaqueta markdown → llama a `generate-pdf` → descarga.
- 6 modos: dossier_operador, presentacion_comercial, borrador_contrato, plan_estrategico, informe_war_room, email_comunicacion.

## Diagnóstico

Tres problemas reales:
1. **Prompts pobres**: 10-15 líneas no producen un dossier de consultoría real.
2. **Salida sin estructura**: markdown libre → PDF no puede maquetar bloques específicos (KPIs, tablas comparativas, hero stats, callouts).
3. **Plantilla HTML única**: el mismo template para un email que para un plan estratégico de 30 páginas. Absurdo.

## Solución propuesta

### Arquitectura nueva

```text
ai-forge (rediseñada)
  ├── prompt maestro por modo (200-400 líneas, nivel consultoría)
  ├── modelo: google/gemini-3.1-pro-preview (motor más potente)
  ├── salida: JSON estructurado vía tool calling
  │     { meta, cover, sections[], kpis[], tables[], callouts[], appendix }
  └── opcional: generar imágenes hero con nano-banana-pro

generate-pdf-v2 (nueva edge function)
  ├── recibe el JSON estructurado + mode
  ├── selecciona plantilla HTML específica por modo
  ├── renderiza con componentes: KpiGrid, ComparisonTable, Callout, Quote, Timeline
  ├── tipografía editorial: Playfair Display (titulares) + Inter (cuerpo)
  └── html2pdf.app → PDF A4 perfecto
```

### Plantillas por modo (6 templates HTML diferentes)

| Modo | Estética | Componentes clave |
|---|---|---|
| dossier_operador | Ficha consultoría navy/gold | Portada con logo+sector, hero stats, perfil financiero, tabla histórico negociaciones, mapa presencia, recomendaciones en callouts |
| presentacion_comercial | Estilo deck inmobiliario premium | Cover con hero image generada IA, KPI grid, tenant mix donut, proyecciones tabla, CTA final |
| borrador_contrato | Documento legal serio | Portada sobria, TOC clausulado, numeración jerárquica, footer "borrador no vinculante" en cada página |
| plan_estrategico | Informe McKinsey clásico | Executive summary, DAFO 2×2, roadmap timeline, tabla acciones, proyección financiera con gráfico |
| informe_war_room | Dashboard ejecutivo impreso | Hero KPIs, semáforos de estado, tabla operaciones, alertas en callouts rojos |
| email_comunicacion | Plantilla email profesional | NO PDF — preview HTML email + opción copiar HTML/texto |

### Cambios concretos

**1. `supabase/functions/ai-forge/index.ts`**
- Subir a `gemini-3.1-pro-preview` (con fallback a flash si 429).
- Reescribir los 6 prompts: cada uno 200-400 líneas, con ejemplos few-shot, tono consultoría.
- Añadir tool calling para output JSON estructurado por modo.
- Mantener compat: si el cliente pide `format=markdown` devuelve string como hoy; si `format=structured` devuelve JSON.

**2. `supabase/functions/generate-pdf-v2/index.ts` (nueva)**
- 6 funciones `renderTemplate_<mode>(structuredData)` → HTML.
- CSS compartido base + overrides por modo.
- Importa Google Fonts: Playfair Display, Inter, JetBrains Mono.
- Mantiene html2pdf.app como motor.

**3. `src/services/pdfService.ts`**
- Nueva función `generateForgeDocumentPdf(mode, structuredData)` que llama a `generate-pdf-v2`.
- Mantener `generateProfessionalPdf` para uso genérico de AVA.

**4. `src/pages/GeneradorDocumentos.tsx` y `src/components/proyecto/ProyectoForge.tsx`**
- El flujo de generación pide JSON estructurado.
- Preview en pantalla: render HTML real (no markdown) usando un iframe con la misma plantilla.
- Botón "Exportar PDF" envía el JSON a `generate-pdf-v2`.
- Para `email_comunicacion`: tabs "Vista previa email" + "HTML" + "Texto plano", sin botón PDF.

**5. Imágenes hero (opcional, solo `presentacion_comercial`)**
- Tras generar el JSON, llamada extra a `google/gemini-3-pro-image-preview` con prompt derivado del título.
- Imagen base64 embebida en la portada del PDF.
- Toggle "Generar imagen de portada" para no consumir créditos siempre.

## Nano Banana / NotebookLM

- **NotebookLM**: no tiene API pública, descartado.
- **Nano Banana Pro 2** (`gemini-3.1-flash-image-preview`): sí, lo uso para portadas de presentación comercial cuando el toggle esté activo. Buena calidad, rápido.

## Alcance entregable

Fase única, 4 archivos modificados + 1 nueva edge function:
- `ai-forge/index.ts` (reescrito)
- `generate-pdf-v2/index.ts` (nuevo, 6 plantillas)
- `pdfService.ts` (nueva función)
- `ragService.ts` (tipo `StructuredForgeOutput` + opción format)
- `GeneradorDocumentos.tsx` y `ProyectoForge.tsx` (preview HTML + nuevo flujo PDF)

## Lo que NO hago en esta fase
- No toco la rotación de keys ni el worker de ingesta (separado).
- No toco el resto del rediseño Claude/tokens (separado, ya pendiente).
- No genero PPTX nativo (los modos "presentacion" salen como PDF apaisado tipo deck, no como .pptx).

## Decisiones que necesito confirmar

Solo dos cosas antes de implementar:

---

# Plan: Generador de Documentos profesional v2

## Qué cambia

1. **Motor más potente**: Gemini 3.1 Pro Preview con prompts de nivel consultoría (200-400 líneas por modo).
2. **Salida estructurada**: JSON con secciones tipadas (KPIs, tablas, callouts, timeline) en vez de markdown plano.
3. **6 plantillas HTML profesionales**, una por tipo de documento, con tipografía editorial (Playfair + Inter), portada con identidad fuerte, TOC, numeración, footer corporativo.
4. **Preview real en pantalla**: ves el documento maquetado, no el markdown.
5. **Imagen de portada con IA** (nano-banana-pro) opcional para presentaciones comerciales.

## Componentes nuevos

- Edge function `generate-pdf-v2` con renderers por modo.
- Edge function `ai-forge` reescrita con tool calling estructurado.
- Preview HTML embebido en `GeneradorDocumentos` y `ProyectoForge`.

## Estética

- Mantenemos línea McKinsey/consultoría (navy + gold) para informes — coherente con tu memoria de `report-aesthetic`.
- Cada modo con su personalidad: dossier=ficha, presentación=deck, contrato=legal sobrio, plan=informe ejecutivo, war room=dashboard impreso, email=HTML mail.

## Trabajo estimado

~45 min. Una sola fase.

