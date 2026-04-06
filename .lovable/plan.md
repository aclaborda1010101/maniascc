

## Plan: Contactos vinculados desde Operadores/Activos + Subdivisiones de Operador

### Resumen
Permitir crear contactos directamente desde la ficha de Operador y de Activo (auto-vinculados). Introducir el concepto de "Subdivisión" (ej: Dirección Regional Norte) dentro de un operador, donde cada subdivisión tiene sus propios contactos.

### 1. Base de datos (2 migraciones)

**Tabla `operador_subdivisiones`** (nueva):
```text
id          uuid PK default gen_random_uuid()
operador_id uuid NOT NULL
nombre      text NOT NULL  (ej: "Dirección Zona Norte")
descripcion text
created_at  timestamptz default now()
```
RLS: SELECT para authenticated, INSERT/UPDATE/DELETE para gestor/admin.

**Columnas nuevas en `contactos`**:
- `subdivision_id uuid` (nullable, referencia lógica a operador_subdivisiones)
- `activo_id uuid` (nullable, para vincular contacto a un activo)

Esto permite:
- Contacto matriz del operador: `operador_id` = X, `subdivision_id` = NULL
- Contacto de subdivisión: `operador_id` = X, `subdivision_id` = Y
- Contacto vinculado a activo: `activo_id` = Z

### 2. OperadorDetail.tsx - Nueva tab "Contactos"

Añadir una 4a tab "Contactos" con dos secciones:

**Contacto Matriz**: lista de contactos donde `operador_id = id` y `subdivision_id IS NULL`. Botón "Añadir contacto" abre un dialog con el formulario de creación (reutilizando campos de CreateContactForm) con `operador_id` pre-rellenado.

**Subdivisiones**: 
- Botón "Nueva subdivisión" (dialog con campo nombre + descripción)
- Lista de subdivisiones colapsables, cada una muestra sus contactos (`subdivision_id = sub.id`)
- Dentro de cada subdivisión, botón "Añadir contacto" que pre-rellena `operador_id` + `subdivision_id`

### 3. LocalDetail.tsx (Activos) - Nueva tab "Contactos"

Añadir tab "Contactos" al detalle del activo:
- Lista de contactos donde `activo_id = id`
- Botón "Añadir contacto" con `activo_id` pre-rellenado
- Cada contacto se muestra como fila con nombre, cargo, email, teléfono y link a su ficha

### 4. Componente reutilizable

Crear `src/components/QuickCreateContactDialog.tsx`:
- Dialog con formulario reducido (nombre, apellidos, cargo, email, teléfono)
- Props: `operadorId?`, `subdivisionId?`, `activoId?`, `onCreated()`
- Al crear, inserta en `contactos` con los IDs pre-vinculados

### 5. Archivos afectados

| Archivo | Acción |
|---|---|
| `supabase/migrations/...` | Nueva tabla + columnas |
| `src/components/QuickCreateContactDialog.tsx` | Nuevo componente |
| `src/pages/OperadorDetail.tsx` | Tab "Contactos" + sección subdivisiones |
| `src/pages/LocalDetail.tsx` | Tab "Contactos" vinculados al activo |
| `src/pages/Contactos.tsx` | Mostrar subdivisión en la lista si existe |
| `src/components/contactos/ContactDetailPanel.tsx` | Mostrar subdivisión en el perfil |

### Nota técnica
- La tabla `operadores` mantiene `contacto_nombre/email/telefono` como datos rápidos de referencia (legacy), pero los contactos reales viven en la tabla `contactos`
- Los contactos creados desde operador/activo aparecerán también en la lista general de /contactos

