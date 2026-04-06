

## Plan: Reestructurar Operadores, Activos e Importar

### Resumen
Simplificar Activos (solo info + contactos), reorganizar Operadores con jerarquía Matriz/Sub-operadores donde contactos y documentos viven a nivel de sub-operador, y mover Importar dentro de la página de Contactos.

### 1. Activos (`LocalDetail.tsx`)
- Eliminar tab "Matches" y el sidebar de "Acciones IA" / "Estadísticas"
- Dejar solo la info editable del activo y los contactos vinculados en una vista directa (sin tabs o con 2 tabs: Info + Contactos)

### 2. Formulario crear operador (`Operadores.tsx`)
- Al seleccionar "Matriz existente", auto-rellenar el sector con el de la matriz seleccionada (campo deshabilitado)
- Cambiar label "Nombre" por un nombre identificativo (no persona)
- Añadir campo "Dirección" (calle)
- Añadir selector de activo vinculado (lista de activos existentes, opcional)
- Quitar campos de contacto persona del formulario de creación (contactos se gestionan dentro del detalle)

### 3. Detalle operador (`OperadorDetail.tsx`)
- Tabs: "Información General", "Perfil IA", "Sub-operadores"
- Eliminar tabs "Contactos" y "Documentos" a nivel de operador matriz
- Tab "Sub-operadores": lista de operadores cuyo `matriz_id` = este operador
  - Cada sub-operador se muestra como card colapsable con: nombre, dirección, sector, presupuesto, superficie, contacto asociado (query a `contactos` por `operador_id`), documentos (del storage `operadores/{subId}`)
  - Botón "Nuevo sub-operador" que abre el mismo dialog de creación con la matriz pre-seleccionada

### 4. Migración DB
- Añadir columna `direccion text` a la tabla `operadores` (para la dirección física)
- Añadir columna `activo_id uuid` a la tabla `operadores` (vínculo opcional a un activo)

### 5. Importar dentro de Contactos
- Eliminar "Importar" del sidebar (`AppSidebar.tsx`)
- Eliminar la ruta `/importar` independiente del router
- Integrar las tabs de importación (CSV, WhatsApp, Email, Plaud) como un dialog/modal accesible desde un botón "Importar" en la página `/contactos`
- Reutilizar el componente `ImportContactosModal` existente ampliado o mantener el botón que ya existe

### 6. Sidebar (`AppSidebar.tsx`)
- Quitar `{ title: "Importar", url: "/importar", icon: Import }` de `directoryItems`

### Archivos afectados

| Archivo | Acción |
|---|---|
| `supabase/migrations/...` | Añadir `direccion`, `activo_id` a operadores |
| `src/pages/Operadores.tsx` | Refactor formulario creación |
| `src/pages/OperadorDetail.tsx` | Tabs Info/IA/Sub-operadores, quitar Contactos/Documentos |
| `src/pages/LocalDetail.tsx` | Simplificar: quitar Matches y sidebar IA |
| `src/components/AppSidebar.tsx` | Quitar "Importar" |
| `src/pages/Contactos.tsx` | Añadir botón/modal importar integrado |
| `src/App.tsx` | Redirect `/importar` a `/contactos` |

### Nota
- La tabla `operador_subdivisiones` y `subdivision_activos` quedan como están pero el foco de la UI pasa a usar la relación `matriz_id` de `operadores` para la jerarquía Matriz > Sub-operadores
- Los contactos y documentos se gestionan a nivel de cada sub-operador individual

