

## Plan: Corregir costes IA falsos en todas las Edge Functions

### El problema real (con datos)

Los 2.158€ que ves en el Dashboard son **falsos**. Las Edge Functions tienen costes **hardcodeados** que no corresponden con los tokens reales:

| Servicio | Coste registrado | Coste REAL (por tokens) | Inflación |
|---|---|---|---|
| `localizacion-patrones` (6 calls) | 0.90€ (6 × 0.15€ fijo) | 0.001€ | **×720** |
| `tenant-mix-avanzado` (2 calls) | 0.50€ (2 × 0.25€ fijo) | 0.0004€ | **×1,125** |
| `ava-orchestrator` (11 calls Pro) | 0.61€ | 0.61€ | Correcto |
| `ava-orchestrator` (55 calls Flash) | 0.004€ | 0.004€ | Correcto |

El orchestrator calcula bien (usa tokens reales). Pero las funciones especializadas ponen costes inventados (`0.15€`, `0.25€`, `0.10€`, `0.08€` por llamada) que son cientos de veces superiores al coste real de Flash (~0.0002€ por llamada con ~500 tokens).

**Coste real del mes: ~0.62€, NO 2.16€**

### Cambios

#### 1. `supabase/functions/ai-localizacion-patrones/index.ts` (linea 137)
- Cambiar `coste_estimado: 0.15` por calculo dinámico basado en tokens:
```
coste_estimado: (tokens_in * 0.10 / 1_000_000 + tokens_out * 0.40 / 1_000_000) * 0.92
```

#### 2. `supabase/functions/ai-tenant-mix-avanzado/index.ts` (linea 128)
- Cambiar `coste_estimado: 0.25` por mismo calculo dinámico

#### 3. `supabase/functions/ai-validacion-retorno/index.ts` (linea 123)
- Cambiar `coste_estimado: 0.10` por calculo dinámico

#### 4. `supabase/functions/ai-perfil-negociador/index.ts` (linea 140)
- Cambiar `coste_estimado: 0.08` por calculo dinámico

#### 5. `supabase/functions/ava-orchestrator/index.ts` (lineas 344 y 644)
- Cambiar `model: "gemini-2.5-pro"` a `model: "google/gemini-3.1-pro-preview"` en `usage_logs`

#### 6. `src/pages/Consumo.tsx`
- Añadir `"google/gemini-3.1-pro-preview"` a `MODEL_PRICING` con rates reales ($1.25/$10.00 por 1M)
- Actualizar nota de modelos activos

### Resultado
- Dashboard y Consumo mostrarán el mismo coste (real, basado en tokens)
- Las funciones Flash registrarán ~0.0002€ por llamada en vez de 0.15-0.25€
- El orchestrator Pro seguirá registrando correctamente (~0.05€/llamada)
- Los datos históricos seguirán inflados pero los nuevos serán correctos

