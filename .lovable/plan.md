## Problema

En la pantalla de bienvenida del Asistente (`/asistente`), los chips de sugerencias ("Resumen del día", "Matches calientes", "Redacta email a operador", "Genera dossier", "Próximas tareas") se ven con fondo cian translúcido y el texto prácticamente invisible (mismo tono que el fondo).

Causa: en `src/pages/AsistenteIA.tsx` (línea 398) los botones usan `bg-card` + `text-foreground`, pero el tema oscuro visionOS aplica un fondo glass/cian que está pisando el contraste del texto.

## Cambio

Único archivo a tocar: `src/pages/AsistenteIA.tsx` (líneas 393-403).

1. Reemplazar las clases del `<button>` de sugerencia por una combinación que garantice contraste:
   - Fondo glass más oscuro y opaco: `bg-background/60 backdrop-blur-md`
   - Texto explícito: `text-foreground/90` con `font-medium`
   - Borde iridiscente sutil acorde al design system: `border-accent/20 hover:border-accent/60`
   - Hover: `hover:bg-accent/10 hover:text-foreground`
2. Mantener radio, padding y `shrink-0` actuales.
3. Sin cambios de lógica, sin tocar `SUGGESTIONS`, sin tocar el edge function ni el toggle Pro.

## Verificación

- Recargar `/asistente` con conversación vacía y comprobar que los 5 chips muestran el texto legible sobre el fondo nocturno.
- Verificar hover (borde y fondo cambian, texto sigue legible).
- Comprobar en viewport móvil que el scroll horizontal sigue funcionando.
