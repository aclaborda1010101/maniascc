import { useEffect, useState } from "react";
import { Sparkles, Check } from "lucide-react";

interface Step {
  /** segundos a partir de los cuales este paso queda "activo" */
  at: number;
  label: string;
}

/**
 * Indicador de razonamiento progresivo que se muestra mientras el
 * orquestador procesa la pregunta. No refleja el estado real del
 * backend (los timings son una aproximación cuidada), pero da la
 * sensación de progreso continuo y elimina la sensación de timeout.
 *
 * Si `pro` está activo, se muestran pasos extra que reflejan el
 * razonamiento más profundo del modelo Pro.
 */
export function AvaThinkingIndicator({ pro = false }: { pro?: boolean }) {
  const steps: Step[] = pro
    ? [
        { at: 0,    label: "Analizando tu consulta" },
        { at: 1.5,  label: "Consultando memoria y conversación previa" },
        { at: 4,    label: "Buscando en RAG de contratos y documentos" },
        { at: 8,    label: "Cruzando datos de operadores y activos" },
        { at: 13,   label: "Aplicando razonamiento profundo (Pro)" },
        { at: 20,   label: "Formulando respuesta estratégica" },
        { at: 32,   label: "Puliendo conclusiones y recomendaciones" },
      ]
    : [
        { at: 0,    label: "Analizando tu consulta" },
        { at: 1.2,  label: "Consultando memoria y conversación previa" },
        { at: 3,    label: "Buscando en RAG de contratos y documentos" },
        { at: 6,    label: "Cruzando datos relevantes" },
        { at: 10,   label: "Formulando respuesta" },
        { at: 18,   label: "Refinando detalles" },
      ];

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Índice del paso "actual" (el último cuyo `at` ya se ha superado)
  const currentIdx = steps.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 pl-1">
        <div className="relative h-8 w-8 rounded-xl gradient-iridescent grid place-items-center glow-ring-soft shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
        </div>
        <span className="text-[11px] text-muted-foreground">
          AVA está pensando{pro ? " · modo Pro" : ""}…
        </span>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {elapsed.toFixed(1)}s
        </span>
      </div>

      <div className="glass rounded-3xl p-4 md:p-5 space-y-2.5">
        {steps.slice(0, currentIdx + 1).map((step, i) => {
          const isCurrent = i === currentIdx;
          return (
            <div
              key={step.label}
              className={`flex items-center gap-2.5 text-[12px] transition-opacity ${
                isCurrent ? "text-white/85" : "text-white/45"
              } animate-in fade-in slide-in-from-left-2 duration-300`}
            >
              <span className="relative inline-flex h-4 w-4 items-center justify-center shrink-0">
                {isCurrent ? (
                  <>
                    <span className="absolute inset-0 rounded-full bg-cyan-300/30 animate-ping" />
                    <span className="relative h-2 w-2 rounded-full bg-gradient-to-br from-cyan-300 to-emerald-300 shadow-[0_0_8px_hsl(180_90%_65%/0.7)]" />
                  </>
                ) : (
                  <Check className="h-3 w-3 text-cyan-300/70" />
                )}
              </span>
              <span className="leading-tight">
                {step.label}
                {isCurrent && (
                  <span className="inline-flex ml-1 align-middle">
                    <span className="w-1 h-1 rounded-full bg-current opacity-70 animate-bounce [animation-delay:-0.2s] mr-0.5" />
                    <span className="w-1 h-1 rounded-full bg-current opacity-70 animate-bounce [animation-delay:-0.1s] mr-0.5" />
                    <span className="w-1 h-1 rounded-full bg-current opacity-70 animate-bounce" />
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
