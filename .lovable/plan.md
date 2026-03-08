

## ATLAS — Fase 0: MVP Básico para F&G

### 1. Configurar Supabase (Base de datos + Auth)
- Conectar proyecto Supabase a Lovable
- Crear tablas: `perfiles`, `locales`, `operadores`, `matches`, `auditoria_ia`
- Crear tabla `user_roles` con enum (`admin`, `gestor`, `inversor`) para control seguro de roles (separada de perfiles)
- Habilitar RLS en todas las tablas con políticas según la matriz de permisos del PRD
- Crear buckets de Storage: `documentos_contratos` (privado), `multimedia_locales` (público)

### 2. Autenticación y Layout base
- Pantalla `/login` con email/password usando Supabase Auth
- Layout compartido: Sidebar de navegación (Locales, Operadores, Matching, Dashboard) + Header con perfil de usuario
- Rutas protegidas: redirigir a `/login` si no hay sesión
- Registro de perfil automático al crear usuario (trigger en `perfiles`)

### 3. Dashboard — Torre de Control (`/dashboard`)
- 4 tarjetas de métricas: Total Locales, Operadores Activos, Matches Exitosos, Coste IA Acumulado
- Gráfico de actividad reciente con recharts
- Lista de últimos matches generados
- Estados: Loading (skeletons), Empty state, Error (toast)

### 4. Directorio de Locales (`/locales`, `/locales/:id`)
- Listado con filtros (estado, m², código postal) y búsqueda por texto
- CRUD completo: crear, editar, eliminar locales
- Ficha de detalle con datos del local y botón "Generar Matches IA" (con icono Sparkles)
- Tabla inferior con histórico de matches del local

### 5. Directorio de Operadores (`/operadores`, `/operadores/:id`)
- Listado con filtros (sector, presupuesto, m²)
- CRUD completo
- Ficha de detalle con datos del operador y campo `perfil_ia` (solo lectura, marcado con icono de IA)

### 6. Matching IA (`/matching/:localId`)
- Al pulsar "Generar Matches IA": spinner de carga, llamada a Edge Function `generate-match`
- Edge Function: consulta locales y operadores, calcula compatibilidad por reglas de negocio (m², presupuesto, sector), devuelve top 5 con score y explicación
- Tarjetas `<MatchCard />` con % de afinidad, tags de compatibilidad, explicación, y botones Aprobar/Descartar
- Registro en `auditoria_ia` con coste y latencia
- Fallback: si la IA falla, matching básico por filtros numéricos

### 7. Design System
- Colores según PRD: Primary Slate 900, Accent Blue 500, Background Slate 50
- Tipografía Inter, bordes redondeados, sombras suaves
- Iconos lucide-react (Sparkles para IA, MapPin para locales, Users para operadores)
- Responsive: optimizado para desktop y tablet

### Notas importantes
- La Edge Function de matching inicialmente usará lógica de reglas (m², renta, sector) sin llamadas a LLMs externos, ya que los secrets de AGUSTITO_RAG no están configurados aún
- Los datos se cargarán manualmente o por CSV en una fase posterior
- La integración con servicios externos (RAG, Patterns) se preparará como estructura pero se activará cuando los endpoints estén disponibles

