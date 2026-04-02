

## Plan: Página de Conexiones (/ajustes)

### Resumen
Nueva página `/ajustes` con dos secciones: conexión WhatsApp vía Evolution API (con QR code) y conexión Email vía IMAP. Se añade al sidebar y se crea una edge function para gestionar la instancia de Evolution.

### Cambios

#### 1. Base de datos (migración)
- Añadir columnas a `perfiles`: `imap_host`, `imap_port`, `imap_user`, `imap_password_encrypted`, `imap_connected` (boolean), `evolution_instance_name`, `evolution_connected` (boolean)
- Las columnas `evolution_instance_url` y `evolution_api_key` ya existen en `perfiles`

#### 2. Edge function `evolution-manage` (`supabase/functions/evolution-manage/index.ts`)
- Acción `create_instance`: POST a `{evolution_url}/instance/create` con instance name. Devuelve QR code base64
- Acción `check_status`: GET a `{evolution_url}/instance/connectionState/{instance}`. Devuelve si está conectado
- Acción `get_qr`: GET a `{evolution_url}/instance/connect/{instance}`. Devuelve QR actualizado
- Lee `evolution_instance_url` y `evolution_api_key` del perfil del usuario autenticado
- CORS headers incluidos

#### 3. Nueva página `src/pages/Ajustes.tsx`
**Sección WhatsApp:**
- Campo "Evolution API URL" (prellenado de perfil)
- Campo "Instance Name"
- Botón "Conectar" que:
  1. Guarda URL + instance name en `perfiles`
  2. Llama a edge function `evolution-manage` con acción `create_instance`
  3. Muestra QR code como `<img src="data:image/png;base64,...">`
  4. Polling cada 3s llamando `check_status` hasta estado "open"
  5. Al conectar: muestra badge verde "Conectado", actualiza `evolution_connected = true`

**Sección Email (IMAP):**
- Campos: Servidor IMAP, Puerto (default 993), Usuario, Contraseña
- Botón "Conectar email" que guarda en `perfiles` (contraseña cifrada via edge function)
- Badge de estado conexión

#### 4. Sidebar (`src/components/AppSidebar.tsx`)
- Añadir ítem `{ title: "Ajustes", url: "/ajustes", icon: Settings }` en `adminItems`

#### 5. Router (`src/App.tsx`)
- Lazy import de `Ajustes`
- Ruta `/ajustes` dentro del layout protegido

### Archivos
| Archivo | Acción |
|---|---|
| `supabase/migrations/...` | Nuevas columnas en perfiles |
| `supabase/functions/evolution-manage/index.ts` | Nueva edge function |
| `src/pages/Ajustes.tsx` | Nueva página |
| `src/components/AppSidebar.tsx` | Añadir ítem Ajustes |
| `src/App.tsx` | Añadir ruta /ajustes |

