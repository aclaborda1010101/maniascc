

## Plan: Renombrar "Proyectos" a "Oportunidades" y redefinir tipos

### Resumen
Renombrar toda la sección "Proyectos" a "Oportunidades" en la UI y actualizar los tipos de proyecto en la base de datos para reflejar las 3 líneas de negocio: Desarrollo Comercial, Venta de Activo y Optimización de Centros.

### 1. Migración de base de datos

Actualizar el enum `tipo_proyecto` para reemplazar los tipos actuales por los nuevos:

| Valor DB | Label UI | Descripción |
|---|---|---|
| `desarrollo_comercial` | Desarrollo Comercial | Operadores buscando ubicaciones |
| `venta_activo` | Venta de Activo | Gasolinera, local, suelo, edificio, CC, parque medianas… |
| `optimizacion_centros` | Optimización de Centros | Centros comerciales y parques de medianas |

SQL: Añadir los 3 nuevos valores al enum, migrar filas existentes a `otro` (o mapeo lógico), eliminar los valores antiguos que ya no apliquen. Se mantiene `otro` como fallback.

### 2. Archivos a modificar

**`src/components/AppSidebar.tsx`**
- Cambiar `{ title: "Proyectos", url: "/proyectos" }` → `{ title: "Oportunidades", url: "/oportunidades" }`

**`src/App.tsx`**
- Renombrar rutas: `/proyectos` → `/oportunidades`, `/proyectos/:id` → `/oportunidades/:id`
- Añadir redirect `/proyectos` → `/oportunidades` para retrocompatibilidad

**`src/pages/Proyectos.tsx`**
- Título: "Proyectos" → "Oportunidades"
- Subtítulo: "Gestiona todas las operaciones comerciales" → "Gestiona todas las oportunidades de negocio"
- Botón: "Nuevo Proyecto" → "Nueva Oportunidad"
- `tipoLabels` actualizado con los 3 nuevos tipos + `otro`
- `tipoIcons` y `tipoColors` actualizados
- Formulario de creación: select de tipo con las nuevas opciones; añadir campo "Subtipo de activo" condicional (solo visible cuando tipo = `venta_activo`) con opciones: Gasolinera, Local, Suelo, Edificio, Centro Comercial, Parque de Medianas

**`src/pages/ProyectoDetail.tsx`**
- Actualizar `tipoLabels` y `estadoLabels` con los nuevos valores
- Título de página: "Proyecto" → "Oportunidad"

**`src/components/proyecto/ProyectoResumen.tsx`**
- Actualizar `tipoLabels` con los nuevos tipos

**`src/pages/Dashboard.tsx`**
- Cambiar label "Proyectos Activos" → "Oportunidades Activas"
- Cambiar links y textos que referencien "Proyectos" → "Oportunidades"
- Actualizar URLs `/proyectos` → `/oportunidades`

### 3. Nota técnica
- La tabla en Supabase sigue llamándose `proyectos` (no se renombra la tabla para evitar romper relaciones, edge functions, etc.)
- Solo se cambia la capa de presentación (labels, rutas, menú)
- Se añade redirect de `/proyectos` a `/oportunidades` para no romper enlaces existentes

