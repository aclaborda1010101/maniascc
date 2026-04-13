

## Plan: Rediseño completo del PDF profesional

### Problemas identificados en el PDF actual

1. **Texto cortado entre páginas**: El contenido se monta entre páginas porque los márgenes del API están a `left: 0mm, right: 0mm` y el contenido se envuelve en un solo `<p>` tag, impidiendo que el motor de PDF calcule saltos de página correctos
2. **Márgenes inexistentes**: Se usa `padding` CSS (60px) en lugar de márgenes reales del API, lo que no funciona con html2pdf.app para paginación
3. **Color morado corporativo**: Todos los acentos usan `#6366f1` (morado/indigo) en vez de azul marino
4. **Tipografía y diseño amateur**: Falta jerarquía visual, espaciado profesional, y estructura de informe corporativo

### Cambios a implementar

#### 1. Corregir márgenes en la llamada API
- Cambiar de `left: 0mm, right: 0mm` a `left: 20mm, right: 20mm`
- Ajustar `top: 20mm, bottom: 25mm` para dar espacio al footer
- Eliminar el padding CSS redundante del `.content`

#### 2. Corregir estructura HTML del contenido
- Eliminar el wrapper `<p>${contentWithIds}</p>` que mete todo el contenido en un solo párrafo (causa que no se puedan calcular page-breaks)
- Insertar el HTML directamente: `<div class="content">${contentWithIds}</div>`

#### 3. Paleta de colores: azul marino corporativo
- Reemplazar `#6366f1` (morado) por `#0A1E3D` (azul marino oscuro) como color primario
- Reemplazar `#8b5cf6` por `#1A3A5C` como color secundario
- Usar `#B8860B` (dorado oscuro) como acento sutil para badges y líneas decorativas

#### 4. Rediseño completo de la portada
- Banda superior gruesa (8px) en azul marino
- Logo/nombre "F&G REAL ESTATE" en azul marino con tracking amplio
- Línea decorativa dorada fina
- Título en tipografía Georgia/serif grande (32pt) para elegancia
- Badge del tipo de documento en azul marino
- Fecha en gris elegante
- Footer "DOCUMENTO CONFIDENCIAL" en gris claro

#### 5. Rediseño del índice
- Título "ÍNDICE" con underline en azul marino
- Numeración con puntos guía (dot leaders) entre título y número
- Tipografía más limpia y espaciado generoso

#### 6. Rediseño del contenido
- `h1`: 18pt, azul marino, mayúsculas, con línea inferior
- `h2`: 14pt, azul marino, borde izquierdo grueso (4px) en vez de borde inferior
- `h3`: 12pt, gris oscuro, weight 600
- Párrafos: 10.5pt, interlineado 1.8, justificados
- Tablas: cabecera azul marino con texto blanco, bordes sutiles, zebra-striping
- Listas: bullets personalizados, indentación correcta
- Blockquotes: borde izquierdo azul marino, fondo gris muy claro
- `page-break-inside: avoid` en tablas, blockquotes y listas
- `page-break-after: avoid` en todos los headings

#### 7. Footer profesional
- Línea fina separadora
- "F&G Real Estate" a la izquierda, "Pág X / Y" a la derecha
- Tipografía 8px en gris

### Archivos a modificar
- `supabase/functions/generate-pdf/index.ts` — rediseño completo del HTML/CSS y parámetros del API

### Resultado esperado
Un PDF con aspecto de informe de consultoría McKinsey/Deloitte: sobrio, azul marino, tipografía serif en portada, sans-serif en contenido, márgenes generosos, sin texto cortado entre páginas.

