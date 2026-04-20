

# Plan: Acelerar la navegación entre secciones del menú lateral

## Diagnóstico

Cuatro causas combinadas hacen que cada clic se sienta lento:

1. **Lazy loading sin prefetch**: cada página se descarga la primera vez que entras, mostrando el spinner global.
2. **Sin caché de datos**: el 95 % de las páginas usa `useState + useEffect` con varias queries Supabase en paralelo. Volver a una sección ya visitada vuelve a pedirlo todo desde cero.
3. **`PageLoader` a pantalla completa**: oculta el contenido anterior y se percibe como "se ha quedado en blanco" aunque tarde 200 ms.
4. **Coste del glassmorphism**: `backdrop-filter: blur(16-24px) saturate(180%)` en sidebar + header + cards + dialogs + tabs + inputs, sumado a los blobs gradientes `fixed` de fondo, fuerza al navegador a recomponer una capa muy cara en cada navegación.

## Cambios propuestos

### 1. Prefetch de páginas al pasar el ratón (impacto alto, riesgo bajo)
- Convertir cada `lazy(() => import(...))` en una constante con su importador reutilizable y exponer una función `prefetch()`.
- En `AppSidebar.tsx`, añadir `onMouseEnter` / `onFocus` al `NavLink` para disparar `prefetch()` del chunk de la ruta destino. Cuando el usuario hace clic, el JS ya está descargado → navegación casi instantánea.

### 2. Mantener el contenido anterior visible durante la transición (UX)
- Sustituir el `PageLoader` global por una **barra de progreso superior** (estilo NProgress, 2 px) cuando `Suspense` está cargando.
- El layout (sidebar, header) permanece visible y el contenido anterior se mantiene hasta que llega el nuevo. Sensación de "instantáneo".

### 3. Migrar el fetching de páginas críticas a React Query (caché real)
Páginas con más impacto en navegación repetida:
- `Dashboard`, `Proyectos`, `Operadores`, `Contactos`, `Locales`, `Documentos`, `Conocimiento`.

Para cada una:
- Reemplazar `useState + useEffect + supabase.from` por `useQuery({ queryKey, queryFn, staleTime: 60_000 })`.
- Configurar `QueryClient` con `staleTime: 30_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: false`.

Resultado: volver a una sección visitada en los últimos 30-60 s **no dispara ninguna petición** y la página aparece instantánea.

### 4. Reducir el coste del glassmorphism sin perder el look
- Bajar `--glass-blur` de `16px` → `12px` y `--glass-blur-strong` de `24px` → `18px`.
- Bajar `--glass-saturate` de `180%` → `140%`.
- En `body::before`, bajar `filter: blur(80px)` → `blur(60px)` y opacidad de `0.9` → `0.6` (claro) / `0.7` → `0.5` (oscuro).
- En `.glass-input` quitar `backdrop-filter` (los inputs no necesitan blur propio, basta con el del card que los contiene).
- Añadir `will-change: backdrop-filter` solo al sidebar y header (las superficies fijas), para que el navegador las promueva a capa propia y no las recomponga al cambiar de ruta.
- Mantener el fallback `@supports not (backdrop-filter)` ya existente.

### 5. Memoizar el sidebar
- Envolver `AppSidebar` en `React.memo`. Hoy se vuelve a renderizar en cada cambio de ruta porque `useLocation` cambia, pero los items son estáticos: separar el cálculo de `isActive` en un subcomponente memoizado por item para evitar re-render del árbol entero.

## Detalles técnicos

- React Query ya está instalado (`@tanstack/react-query`) y `QueryClientProvider` montado en `App.tsx` — solo hay que ajustar defaults y migrar páginas.
- Patrón de prefetch:
  ```ts
  const importDashboard = () => import("./pages/Dashboard");
  const Dashboard = lazy(importDashboard);
  // en sidebar: onMouseEnter={() => importDashboard()}
  ```
  Vite cachea el módulo, así que llamarlo dos veces no descarga dos veces.
- Barra de progreso: componente propio de 30 líneas que escucha el estado de `Suspense` vía un wrapper, sin librería externa.
- Para las páginas migradas a React Query, mantener la firma de los componentes igual: solo cambia el interior del `useEffect`.

## Entregables

1. `src/App.tsx`: importadores nombrados + `QueryClient` con `staleTime`/`gcTime` ajustados + `TopProgressBar` reemplazando `PageLoader`.
2. `src/components/TopProgressBar.tsx`: nuevo, barra superior animada para Suspense.
3. `src/components/AppSidebar.tsx`: `onMouseEnter` con prefetch + `React.memo` + items memoizados.
4. `src/index.css`: tuning de variables glass (`--glass-blur`, `--glass-saturate`, opacidad blobs) + `will-change` en `.glass-sidebar` y header.
5. Migración a React Query de: `Dashboard.tsx`, `Proyectos.tsx`, `Operadores.tsx`, `Contactos.tsx`, `Locales.tsx`, `Documentos.tsx`, `Conocimiento.tsx`.

## Resultado esperado

- **1ª visita** a una sección: ~200-400 ms más rápido (chunk ya prefetched al hover).
- **2ª visita** dentro de 30-60 s: **instantánea** (datos en caché, sin petición).
- **Glassmorphism**: misma estética, ~30-40 % menos coste de pintado por frame.
- **Sin spinner a pantalla completa**: barra fina arriba, contenido anterior visible.

