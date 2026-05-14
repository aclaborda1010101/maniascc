## Diagnóstico

`⚙️ rag_search:blocked` aparece cuando concurren **dos cosas**:

1. **Filtro de dominios activo en el cliente** (`AvaDomainFilter`). Por defecto está activo con todos los dominios menos `personal` (`DEFAULT_DOMAINS` en `src/components/AvaDomainFilter.tsx:24-26`).
2. **El modelo decide buscar explícitamente en un dominio fuera del filtro** (típicamente `personal`, o cuando el usuario reduce más el filtro y AVA elige uno excluido).

Entonces el orquestador (`supabase/functions/ava-orchestrator/index.ts:1239-1247`) rechaza la llamada y devuelve `blocked_by_filter: true`, marcándola como `rag_search:blocked`.

NO es el RAG quien bloquea. NO hay datos privados ocultos. NO hay bug de RLS. Es la propia política del filtro de dominios la que el modelo está saltándose y el orquestador la frena.

## Cambio propuesto: degradación elegante en lugar de bloqueo

En vez de devolver error y dejar al modelo sin contexto, **convertir el bloqueo en un fallback automático**: si el modelo pide un dominio fuera del filtro, se ejecuta igualmente la búsqueda usando los dominios permitidos como `dominios[]`, y se le devuelve un aviso informativo en el resultado (no un error).

### 1. `supabase/functions/ava-orchestrator/index.ts` (≈línea 1239)

Antes:
```ts
if (allowedDomains.includes(args.dominio)) { effectiveDomains = [args.dominio]; }
else { result = { error: "...", blocked_by_filter: true }; toolLabel = "rag_search:blocked"; }
```

Después:
```ts
if (allowedDomains.includes(args.dominio)) {
  effectiveDomains = [args.dominio];
} else {
  // No bloqueamos: ejecutamos en los dominios permitidos y avisamos
  effectiveDomains = allowedDomains;
  warnings.push(`Dominio '${args.dominio}' fuera del filtro. Buscando en: ${allowedDomains.join(", ")}.`);
  toolLabel = "rag_search:fallback";
}
```

Y la respuesta de la tool incluye `warnings` para que el modelo lo cite si es relevante, pero ya tiene resultados reales con los que trabajar.

### 2. Ajustar el system prompt (línea 184 y 839-842)

Reescribir el bloque del filtro para reflejar el nuevo comportamiento:
- "Si pides un dominio fuera del filtro activo, la búsqueda se hará automáticamente en los dominios permitidos. Avisa al usuario solo si el dominio pedido era crítico."

### 3. (Opcional, recomendado) Revisar el `DEFAULT_DOMAINS`

Hoy `personal` viene desactivado por defecto. Si tu RAG personal tiene 56k chunks y son una fuente legítima, plantearse activarlo por defecto. **No lo cambio sin tu OK.**

## Lo que NO cambia

- El usuario sigue pudiendo apagar dominios desde el filtro.
- La búsqueda sigue respetando el filtro (no vamos a buscar en dominios apagados).
- No se toca RLS ni la lógica RAG.

## Resultado visible para ti

- En vez de `⚙️ rag_search:blocked` → verás `⚙️ rag_search` con resultados reales.
- AVA dejará de quedarse muda cuando el modelo elige mal el dominio.
- Si quieres ampliar la cobertura, solo tienes que abrir el filtro arriba del chat y activar más dominios (especialmente `personal`).

## Archivos a tocar

- `supabase/functions/ava-orchestrator/index.ts` (lógica de bloqueo + system prompt).