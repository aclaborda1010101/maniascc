

# Fix: sidebar de AVA no se pliega + input no acepta texto

## Diagnóstico

El bug raíz está en `src/pages/AsistenteIA.tsx` línea 212:

```tsx
<div className="flex-1 flex flex-col min-w-0 relative ambient">
```

La clase `.ambient` definida en `src/index.css` (línea 206) hace:

```css
.ambient { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
```

Está pensada como **capa decorativa de fondo absoluta**, no como modificador de un contenedor flex. Al aplicarla al wrapper del área de chat:

1. **El chat se vuelve `position: fixed`** y se expande a toda la pantalla, tapando el sidebar de conversaciones (de ahí la sensación de "no se pliega": el sidebar sí se reduce a `w-0`, pero el área de chat fixed lo solapa con su propio fondo y blobs).
2. **El `Input` queda dentro de un contenedor con `pointer-events: none`** heredado, así que los clicks/teclado no llegan al `<input>` HTML — por eso "no me deja escribir".
3. Todos los hijos del wrapper pierden su layout flex normal porque `fixed inset-0` rompe el flujo del padre.

## Solución

### Cambio 1 — `src/pages/AsistenteIA.tsx` línea 212

Quitar `ambient` del wrapper del chat y, si queremos atmósfera de fondo, colocarla como hijo decorativo absoluto:

```tsx
// antes
<div className="flex-1 flex flex-col min-w-0 relative ambient">

// después
<div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
  <div className="ambient absolute inset-0 -z-10" aria-hidden />
  {/* …resto del contenido tal cual… */}
```

### Cambio 2 — `src/index.css` línea 206

Hacer la clase `.ambient` segura para uso decorativo en cualquier contenedor (relativa al padre, no al viewport):

```css
.ambient {
  position: absolute;       /* antes: fixed */
  inset: 0;
  z-index: -1;              /* antes: 0  → garantiza que no tape contenido */
  pointer-events: none;
  overflow: hidden;
}
```

Así, donde otras páginas la usen (ej. en el outer layout) seguirá funcionando como decoración de fondo, pero **nunca tapará el contenido ni capturará eventos** porque va a `-z-10`.

### Cambio 3 — limpiar borde del sidebar cuando está cerrado (cosmético)

En la línea 192-199, mover el `border-r` al `<div>` interior y condicionarlo, para que al plegar no quede una línea vertical fantasma:

```tsx
<div className={cn(
  "shrink-0 overflow-hidden transition-all duration-200",
  desktopSidebarOpen ? "w-64 border-r border-white/[0.06]" : "w-0"
)}>
  <div className="w-64 h-full">
    <ConversationList {...convListProps} />
  </div>
</div>
```

(Quitamos el `bg-white/[0.02] backdrop-blur-2xl` del wrapper interior — ya está heredando la atmósfera glass del layout padre y duplicarlo crea la franja gris translúcida que se ve en pantalla.)

## Verificación esperada

- Plegar conversaciones → el área de chat ocupa todo el ancho sin línea vertical residual.
- Click en el input "Pregunta a AVA…" → focus visible y permite escribir con normalidad.
- Atajo `⌘↵` / `Enter` envía como antes.
- Resto de páginas que usen `.ambient` siguen mostrando los blobs de fondo (ahora correctamente confinados al contenedor padre).

## Lo que NO se toca

- Lógica de `useChatMessages`, hooks, edge functions.
- Estilos de mensajes, suggestions, `.glass-edge`, `.pill-iridescent`.
- Sidebar global (`AppSidebar`).

