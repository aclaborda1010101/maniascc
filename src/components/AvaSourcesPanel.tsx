import { useState } from "react";
import { ChevronDown, FileText, Database, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AvaSources {
  documents?: Array<{ name: string; domain?: string; snippet?: string; documento_id?: string; score?: number }>;
  entities?: Array<{ table: string; id?: string; name: string; subtitle?: string }>;
  external?: Array<{ source: string; label: string; detail?: string; url?: string }>;
}

interface Props {
  sources: AvaSources;
  compact?: boolean;
}

const TABLE_LABEL: Record<string, string> = {
  proyectos: "Oportunidad",
  operadores: "Operador",
  contactos: "Contacto",
  activos: "Activo",
  locales: "Local",
  matches: "Match",
  negociaciones: "Negociación",
  documentos_proyecto: "Documento",
  perfiles_negociador: "Perfil negociador",
  configuraciones_tenant_mix: "Tenant mix",
  patrones_localizacion: "Patrón ubicación",
};

export function AvaSourcesPanel({ sources, compact }: Props) {
  const [open, setOpen] = useState(false);
  const docs = sources.documents || [];
  const entities = sources.entities || [];
  const external = sources.external || [];
  const total = docs.length + entities.length + external.length;
  if (total === 0) return null;

  return (
    <div className={cn("mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden", compact && "mt-2")}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/75">Fuentes consultadas</span>
          <span className="opacity-50">·</span>
          {docs.length > 0 && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{docs.length}</span>}
          {entities.length > 0 && <span className="inline-flex items-center gap-1"><Database className="h-3 w-3" />{entities.length}</span>}
          {external.length > 0 && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{external.length}</span>}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-3.5 pb-3 pt-1 space-y-3 text-[11px]">
          {docs.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-foreground/70 font-medium mb-1.5">
                <FileText className="h-3 w-3" /> Documentos ({docs.length})
              </div>
              <ul className="space-y-1.5">
                {docs.map((d, i) => (
                  <li key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground/85 line-clamp-1">{d.name}</span>
                      {d.domain && (
                        <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground/70 bg-white/[0.04] px-1.5 py-0.5 rounded">{d.domain}</span>
                      )}
                    </div>
                    {d.snippet && <p className="mt-0.5 text-muted-foreground line-clamp-2 leading-snug">{d.snippet}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entities.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-foreground/70 font-medium mb-1.5">
                <Database className="h-3 w-3" /> Registros ({entities.length})
              </div>
              <ul className="space-y-1">
                {entities.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/80 shrink-0">{TABLE_LABEL[e.table] || e.table}</span>
                    <span className="text-foreground/85 truncate">{e.name}</span>
                    {e.subtitle && <span className="text-muted-foreground truncate">· {e.subtitle}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {external.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-foreground/70 font-medium mb-1.5">
                <Globe className="h-3 w-3" /> Fuentes externas ({external.length})
              </div>
              <ul className="space-y-1">
                {external.map((s, i) => (
                  <li key={i} className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground/85 font-medium">{s.label}</span>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 shrink-0">{s.source}</span>
                    </div>
                    {s.detail && <p className="text-muted-foreground mt-0.5">{s.detail}</p>}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent text-[10px] hover:underline">
                        {s.url}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
