

## Plan: Eliminar todo lo relacionado con Farmacias

El módulo de Farmacias se coló de otro proyecto. Se eliminará completamente: página, ruta, sidebar, tabla de base de datos, y referencias en búsqueda y dashboard.

### Cambios

1. **Eliminar archivo** `src/pages/Farmacias.tsx`

2. **`src/App.tsx`** — Eliminar el lazy import de Farmacias y la ruta `/farmacias`

3. **`src/components/AppSidebar.tsx`** — Eliminar la entrada "Farmacias" del array `navItems` y el import de `Pill`

4. **`src/pages/Dashboard.tsx`** — Eliminar la KPI "Farmacias Riesgo Alto", la query a `farmacias`, y la referencia a `Pill` icon si solo se usa ahí

5. **`src/pages/Busqueda.tsx`** — Eliminar la query a `farmacias`, el estado `farmacias` del results, la sección de resultados de farmacias, y la referencia en el subtítulo y conteo total

6. **Migración SQL** — `DROP TABLE public.farmacias CASCADE;` para eliminar la tabla, sus políticas RLS y el trigger

