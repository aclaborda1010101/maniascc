

# Plan: arreglar la preview rota por orden de `@import` en `src/index.css`

## Causa
Vite está fallando al compilar `src/index.css` con el error:

```
[vite:css] @import must precede all other statements (besides @charset or empty @layer)
```

El archivo tiene este orden:
```
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter...');
```

El `@import` debe ir **antes** de los `@tailwind`. Por eso la preview no carga estilos correctamente.

## Cambio (1 archivo, 1 commit)

En `src/index.css`, mover la línea `@import url('https://fonts.googleapis.com/...')` al principio del archivo, antes de los tres `@tailwind`. Resultado:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;450;500;550;600;700;800&family=Inter+Tight:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* …resto del archivo intacto… */
```

Sin más cambios. No se toca ningún token, ni componente, ni tailwind config.

## Bonus opcional (no bloqueante)
La consola muestra dos warnings de React (no errores) por refs en `AvaVoiceControls` y `AvaCallButton` dentro de `FloatingChat` — son ruido, no rompen la preview. Lo dejo como mejora futura envolviendo esos componentes con `React.forwardRef` si quieres limpiarlos.

