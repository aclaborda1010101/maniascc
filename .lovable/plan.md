

## Plan: Rediseño mobile-first profesional de toda la aplicación

### Problemas detectados
1. **Dashboard**: Botones "Nueva Oportunidad" / "Nuevo Operador" se cortan horizontalmente. KPI cards grid no se adapta bien.
2. **AppLayout header**: Barra de búsqueda ocupa demasiado espacio en mobile. No hay menú hamburguesa visible (el sidebar usa sheet en mobile pero el trigger es pequeño).
3. **Contactos**: Panel izquierdo fijo de 380px no cabe en mobile. Layout de dos paneles no funciona.
4. **AsistenteIA**: Sidebar de conversaciones fija 256px + chat no cabe en mobile.
5. **Operadores / Activos**: Tablas con scroll horizontal. Filtros con anchos fijos (w-[180px], w-[160px]).
6. **Proyectos**: Filtros con anchos fijos causan overflow.
7. **Todas las páginas**: Botones de acción con texto largo no se apilan en mobile.

### Cambios por archivo

**1. `src/index.css`** — Añadir `overflow-x: hidden` al body y regla global anti-scroll horizontal.

**2. `src/components/AppLayout.tsx`** — Mejorar header mobile:
- Ocultar barra de búsqueda en mobile (solo mostrar icono que expande)
- Hacer el SidebarTrigger más prominente como hamburguesa
- Reducir padding en mobile

**3. `src/pages/Dashboard.tsx`** — Rediseño mobile:
- Header: título y botones en stack vertical en mobile, botones full-width
- KPI cards: `grid-cols-2` en mobile (ya está) pero con texto más compacto
- Botones de acción como iconos en mobile
- Matches/Activity cards: layout vertical en mobile, badges debajo del texto

**4. `src/pages/Contactos.tsx`** — Layout mobile completamente diferente:
- En mobile: panel único con lista. Al seleccionar contacto, se abre como pantalla completa (Sheet/drawer bottom-up o navigate)
- Panel izquierdo ocupa 100% en mobile
- Botones de header full-width

**5. `src/pages/AsistenteIA.tsx`** — Mobile chat:
- Sidebar de conversaciones oculto en mobile, accesible via botón hamburguesa/Sheet
- Chat ocupa 100% width
- Input area más compacta

**6. `src/pages/Operadores.tsx`** — Mobile:
- Reemplazar tabla por cards en mobile
- Filtros apilados verticalmente, full-width
- Botón "Nuevo Operador" full-width

**7. `src/pages/Locales.tsx`** — Mismo patrón que Operadores:
- Cards en lugar de tabla en mobile
- Filtros full-width apilados

**8. `src/pages/Proyectos.tsx`** — 
- Filtros apilados full-width en mobile
- Botón de acción full-width

**9. `src/pages/ProyectoDetail.tsx`** — 
- TabsList scrollable horizontally en mobile
- Header con botón back + estado en stack

**10. `src/components/AppSidebar.tsx`** — Sin cambios mayores (ya usa Sheet en mobile via sidebar component).

### Enfoque visual profesional
- Eliminar `App.css` (estilos demo de Vite no usados)
- Bordes más suaves, sombras sutiles en cards mobile
- Touch targets mínimo 44px en mobile
- Spacing consistente con `p-4` en mobile vs `p-6` en desktop
- Tipografía más ajustada en mobile (títulos más pequeños)

### Archivos a modificar
| Archivo | Tipo de cambio |
|---|---|
| `src/index.css` | overflow-x hidden global |
| `src/App.css` | Eliminar (no se usa) |
| `src/components/AppLayout.tsx` | Header responsive, search colapsable |
| `src/pages/Dashboard.tsx` | Header, KPIs, cards responsive |
| `src/pages/Contactos.tsx` | Layout mobile single-panel + Sheet |
| `src/pages/AsistenteIA.tsx` | Chat sidebar como Sheet en mobile |
| `src/pages/Operadores.tsx` | Cards mobile en vez de tabla |
| `src/pages/Locales.tsx` | Cards mobile en vez de tabla |
| `src/pages/Proyectos.tsx` | Filtros y botones full-width |
| `src/pages/ProyectoDetail.tsx` | Tabs scrollable, header stack |

