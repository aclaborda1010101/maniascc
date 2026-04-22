

# Pulido visual: glass universal + paleta más sobria + fix hover sidebar

## 1) Fix crítico — hover blanco del sidebar

**Causa**: `SidebarMenuButton` (en `src/components/ui/sidebar.tsx` línea 415) aplica `hover:bg-sidebar-accent` y la variable `--sidebar-accent` está definida como `0 0% 100%` (blanco al 100%). Cuando Tailwind compila `bg-sidebar-accent` sin alpha, pinta blanco sólido sobre el wrapper exterior — encima del span interior glass — produciendo el flash blanco que se ve en la captura.

**Solución**:
- En `src/index.css`: cambiar `--sidebar-accent` a `0 0% 100% / 0` (transparente) o quitar el background del wrapper exterior.
- Mejor: en `AppSidebar.tsx`, pasar `className="hover:!bg-transparent active:!bg-transparent data-[active=true]:!bg-transparent"` al `SidebarMenuButton` para neutralizar el background del wrapper. El span interior ya gestiona su propio hover/active glass correctamente.

## 2) Paleta más sobria — bajar el lila dominante

El violeta brillante `--acc-2: 270 100% 77%` (#b98cff) satura toda la UI (sidebar, gradientes de logo, ambient blobs, KPI accents). Cambios:

- `--acc-2: 240 35% 62%` → **azul-índigo apagado** tipo "slate-blue" (#7d83b8). Se mantiene el aire visionOS pero serio, sin el caramelo lila.
- `--acc-3: 215 25% 58%` → de pink/coral a **azul acero suave** (#7d8ba8) para los acentos terciarios — elimina el rosa que aparece en avatares y bordes de cards.
- Dejar intactos: `--acc-1` (azul), `--acc-4` (mint para positivos), `--acc-5` (amber para alertas).
- Bajar opacidad de `.ambient::before/after` de 0.55 → 0.28 y aumentar blur a 140px para que los blobs sean atmósfera, no protagonistas.
- Bajar `glow-ring` y `glow-ring-soft` un 30% para reducir halos lilas.

## 3) Glass universal — páginas pendientes

Las siguientes páginas aún usan `Card` shadcn estándar (fondo opaco), rompiendo la consistencia visual. Reemplazo por `.glass` envoltorio:

| Página | Estado | Acción |
|---|---|---|
| `LocationAnalysis.tsx` | Card opaca | Wrapper `.glass` + ambient blobs |
| `Documentos.tsx` | Cards opacas + tabs | Glass en cards principales y tabs translúcidas |
| `Conocimiento.tsx` | Cards opacas | Glass + chips iridiscentes para dominios |
| `Ajustes.tsx` | Cards opacas | Glass por sección |
| `Consumo.tsx` | KPI cards opacas | `.glass-accent` con acentos por métrica |
| `DossierValidation.tsx` | Card opaca | Glass + ambient |
| `GeneradorDocumentos.tsx` | Card opaca | Glass + iridescent header |
| `Notificaciones.tsx` | Cards opacas | Glass por notificación con dot acento |
| `ProyectoDetail.tsx` | Cards opacas en pestañas + tipos `farmacia` | Glass + eliminar ref `farmacia` (memory rule) |
| `LocalDetail.tsx` | Cards opacas | Glass + ambient |
| `OperadorDetail.tsx` | Cards opacas | Glass + iridescent avatar |
| `Auditoria.tsx` | Cards opacas | Glass para tabla |
| `Admin.tsx` | Cards opacas | Glass por panel |
| `Matching.tsx` | Verificar | Glass si falta |
| `Patrones.tsx` | Verificar acc-2 | Cambiar lila por nueva paleta |

**Patrón de reemplazo**: cada `<Card>` o `<div className="bg-card …">` se convierte en `<div className="glass p-X">` con padding interno y se elimina `<CardHeader>/<CardContent>` (estructura plana). Los headers de página ganan ambient blobs detrás.

## 4) Componentes adicionales

- `MatchCard`, `NegotiatorCard`, `PlanComparisonGrid`, `SynergyMatrix`, `EmptyState`: revisar y aplicar `.glass` si usan Card opaca.
- `FloatingChat` y `FloatingChatPanel`: ya glass, solo verificar nuevo color.

## 5) Lo que NO se toca

- Lógica funcional, hooks, servicios, edge functions.
- Estructura de componentes ricos ya creados (Sparkline, DeltaChip, etc. de la pasada anterior).
- Routing.
- Tipografía (ya está bien).

## Orden de ejecución

1. **Fix sidebar hover** (sidebar.tsx + AppSidebar.tsx) — 5 min, alto impacto inmediato.
2. **Recalibrar paleta** en `index.css` (--acc-2, --acc-3, ambient, glows).
3. **Migración a glass** página por página en el orden de la tabla (LocationAnalysis primero por estar visible en la captura).
4. Verificación final en `/dashboard`, `/oportunidades`, `/oportunidades/:id`, `/localizacion`, `/documentos`, `/ajustes`.

