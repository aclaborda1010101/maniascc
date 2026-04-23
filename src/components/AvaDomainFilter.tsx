import { useState } from "react";
import { Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Lista canónica de dominios documentales del sistema.
 * Mantener en sincronía con `enum dominio` de la tool `rag_search` en `ava-orchestrator`.
 */
export const RAG_DOMAINS: { id: string; label: string; hint?: string }[] = [
  { id: "centros_comerciales", label: "Centros comerciales", hint: "Negocio inmobiliario operativo" },
  { id: "legal", label: "Legal", hint: "Contratos, escrituras, diligencias" },
  { id: "financiero", label: "Financiero", hint: "Modelos, tasaciones, rent rolls" },
  { id: "urbanismo", label: "Urbanismo", hint: "PGOU, licencias" },
  { id: "administrativo", label: "Administrativo", hint: "Facturas, seguros, fiscalidad" },
  { id: "comunicaciones", label: "Comunicaciones", hint: "Emails operativos sin centro" },
  { id: "personal", label: "Personal", hint: "Gmail personal, colegio, viajes" },
  { id: "general", label: "General", hint: "Residuo neutro" },
  // Dominios legacy presentes en chunks históricos
  { id: "activos", label: "Activos (legacy)", hint: "Migrar a centros_comerciales" },
];

/** Dominios activados por defecto si el usuario nunca tocó el filtro. */
export const DEFAULT_DOMAINS = RAG_DOMAINS
  .filter(d => d.id !== "personal")
  .map(d => d.id);

export const STORAGE_KEY = "ava-rag-domain-filter-v1";

export function loadDomainFilter(): string[] {
  if (typeof window === "undefined") return DEFAULT_DOMAINS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DOMAINS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(x => typeof x === "string")) return parsed;
  } catch {
    // ignore
  }
  return DEFAULT_DOMAINS;
}

export function saveDomainFilter(domains: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
  } catch {
    // ignore
  }
}

interface AvaDomainFilterProps {
  value: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
}

export function AvaDomainFilter({ value, onChange, compact = false }: AvaDomainFilterProps) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter(d => d !== id));
    else onChange([...value, id]);
  };

  const allOn = value.length === RAG_DOMAINS.length;
  const noneOn = value.length === 0;
  const personalOff = !value.includes("personal");

  let label = `${value.length}/${RAG_DOMAINS.length}`;
  if (allOn) label = "Todos";
  else if (noneOn) label = "Ninguno";
  else if (personalOff && value.length === RAG_DOMAINS.length - 1) label = "Sin personal";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 text-muted-foreground text-xs rounded-xl hover:bg-white/[0.06]",
            compact && "h-8 px-2"
          )}
          title="Dominios consultados por AVA"
        >
          <Filter className="h-3.5 w-3.5" />
          {!compact && <span>Dominios</span>}
          <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px] border-white/[0.1] text-foreground/70">
            {label}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 p-2 rounded-2xl border-white/[0.08] bg-background/95 backdrop-blur-xl"
      >
        <div className="px-2 py-1.5 flex items-center justify-between">
          <p className="text-xs font-medium text-foreground/85">Dominios documentales</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange(RAG_DOMAINS.map(d => d.id))}
              className="text-[10px] text-accent hover:underline"
            >
              Todos
            </button>
            <span className="text-[10px] text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_DOMAINS)}
              className="text-[10px] text-accent hover:underline"
            >
              Por defecto
            </button>
          </div>
        </div>
        <p className="px-2 pb-2 text-[10px] text-muted-foreground leading-snug">
          Restringe los documentos que AVA consulta. Útil para excluir Gmail personal del contexto de negocio.
        </p>
        <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
          {RAG_DOMAINS.map(d => {
            const on = value.includes(d.id);
            return (
              <button
                type="button"
                key={d.id}
                onClick={() => toggle(d.id)}
                className={cn(
                  "flex items-start gap-2 px-2 py-1.5 rounded-xl text-left transition-colors",
                  on ? "bg-accent/10 hover:bg-accent/15" : "hover:bg-white/[0.04]"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded-md border grid place-items-center",
                    on
                      ? "bg-accent border-accent text-accent-foreground"
                      : "border-white/[0.15] bg-transparent"
                  )}
                >
                  {on && <Check className="h-3 w-3" />}
                </div>
                <div className="min-w-0">
                  <p className={cn("text-xs font-medium", on ? "text-foreground" : "text-foreground/80")}>
                    {d.label}
                  </p>
                  {d.hint && (
                    <p className="text-[10px] text-muted-foreground leading-tight">{d.hint}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
