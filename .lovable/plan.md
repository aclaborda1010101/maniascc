

## Plan: Corregir "Coste IA (mes)" en Dashboard para usar cálculo real por tokens

### Problema
El Dashboard lee `coste_estimado` directamente de `auditoria_ia` y lo suma. Los registros históricos tienen costes hardcodeados inflados (€0.08–€0.25 por llamada) que producen el valor falso de 2.158€. No podemos modificar datos históricos desde el cliente.

### Solución
Cambiar el Dashboard para que recalcule el coste basándose en **tokens reales** (igual que hace la página de Consumo), en lugar de confiar en `coste_estimado` de la base de datos.

### Cambios en `src/pages/Dashboard.tsx`

1. **Ampliar la query de auditoría del mes** (línea 80): además de `coste_estimado, latencia_ms`, traer también `tokens_entrada, tokens_salida, modelo`

2. **Añadir lógica de pricing** (misma que Consumo.tsx): tabla `MODEL_PRICING` con las tarifas reales por modelo, y función `estimateCostFromTokens(modelo, tokens_in, tokens_out)` que calcula `(in * rate_in + out * rate_out) * 0.92`

3. **Recalcular `costeIAMes`** (línea 91): en vez de sumar `coste_estimado`, iterar los registros y sumar el coste calculado por tokens con `estimateCostFromTokens`

### Resultado
- El Dashboard mostrará el coste real (~0.62€) calculado a partir de tokens, no los valores inflados históricos
- Consistente con la página de Consumo
- Nuevos registros (ya corregidos en las Edge Functions) también se mostrarán correctamente

