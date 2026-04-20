

# Plan: eliminar la animación del fondo para arreglar la lentitud

## Causa
Los 5 "blobs" animados con `filter: blur(100–110px)` en el fondo (`.ambient`) están causando que el navegador recompute blur en cada frame. Combinado con `backdrop-filter` en headers/sidebar/cards glass, esto satura la GPU y hace que cada navegación se sienta lenta.

## Cambio (2 archivos)

### 1) `src/index.css`
- **Eliminar las animaciones** `floatA`, `floatB`, `floatC`, `floatD`, `floatE` de los blobs `.ambient::before`, `.ambient::after`, `.ambient-blob.b3/b4/b5`. Los blobs siguen ahí (estáticos) para mantener el look iridescente, pero sin movimiento.
- **Reducir blur** de `100–110px` a `60px` (visualmente idéntico, mucho menos coste).
- **Reducir backdrop-filter** de `blur(32px) saturate(1.8)` a `blur(16px) saturate(1.4)` en `.glass`, `.list-glass`, `.bubble-ava`, `.tab-bar-mobile`.
- **Mantener** la animación del orbe AVA (`spin-slow` en `.ava-orb::before`) — es pequeña y aislada, no afecta rendimiento.
- Añadir `contain: strict` a `.ambient` para aislar repintados.

### 2) `src/components/AppLayout.tsx`
- **Desactivar el `.ambient` en mobile** (`isMobile`). En móvil ya hay poca pantalla y el coste GPU es proporcionalmente mayor.

## Lo que NO cambio
- Paleta, tipografía, glass effect (solo se reduce blur, sigue viéndose translúcido).
- Orbe AVA (sigue girando el ring iridescente, bloque negro y estrella fijos).
- Ninguna lógica, ruta, hook, edge function.

## Resultado esperado
- Navegación instantánea entre páginas.
- Scroll fluido en `/consumo`, `/contactos`, `/dashboard`.
- El fondo iridescente se mantiene visible (estático) en desktop; mobile sin fondo decorativo.
- Menos consumo de batería.

