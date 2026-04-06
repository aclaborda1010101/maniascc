

## Plan: Ampliar modal de Importar en Contactos con 4 tabs

### Resumen
Reemplazar el modal actual `ImportContactosModal` (solo CSV) por un modal completo con 4 pestañas: Contactos (CSV/XLS), WhatsApp (.txt), Email (.eml) y Plaud (audio/transcripción). Se reutiliza la lógica que ya existe en `src/pages/Importar.tsx`.

### Cambios

#### 1. `src/components/contactos/ImportContactosModal.tsx`
Reescribir el componente para incluir las 4 tabs dentro del Dialog existente:
- Mover las funciones `TabContactos`, `TabWhatsApp`, `TabEmail`, `TabPlaud` y el componente `DropZone` desde `Importar.tsx` al modal
- Mantener la misma interfaz de props (`open`, `onOpenChange`, `onImported`)
- Usar `Tabs` con 4 `TabsTrigger` dentro del `DialogContent`
- Ampliar `max-w` del dialog a `max-w-3xl` para acomodar las tabs

#### 2. `src/pages/Contactos.tsx`
Sin cambios necesarios: ya tiene el botón de importar (icono Upload) y el `ImportContactosModal` conectado.

#### 3. Sin cambios en sidebar ni rutas
El botón vive dentro de la cabecera de `/contactos`. La ruta `/importar` sigue redirigiendo a `/contactos`.

### Archivos afectados

| Archivo | Acción |
|---|---|
| `src/components/contactos/ImportContactosModal.tsx` | Reescribir con 4 tabs |

