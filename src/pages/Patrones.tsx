import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Loader2, RefreshCw, MessageSquare, ShieldCheck, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { MemoriaAvaPanel } from "@/components/MemoriaAvaPanel";

interface Pattern {
  title: string;
  confidence: number;
  description: string;
  sources: string[];
  contrary_evidence?: string;
}

interface PatternResult {
  verdict?: string;
  win_rate?: number;
  patterns: Pattern[];
}

function parsePatterns(answer: string): PatternResult {
  const patterns: Pattern[] = [];
  let verdict = "";
  let win_rate: number | undefined;

  try {
    const jsonMatch = answer.match(/```json\s*([\s\S]*?)```/) || answer.match(/\{[\s\S]*"patterns"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (parsed.patterns) return parsed;
    }
  } catch {}

  const sections = answer.split(/(?=\n\s*(?:\d+[\.\)]\s+|\*\*[^*]+\*\*|#{1,3}\s+))/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 15) continue;

    const verdictMatch = trimmed.match(/veredicto[:\s]*[*]*\s*(.*?)(?:\n|$)/i);
    if (verdictMatch) verdict = verdictMatch[1].replace(/\*\*/g, "").trim();

    const wrMatch = trimmed.match(/win\s*rate[^:]*[:\s]*(\d+(?:\.\d+)?)\s*%?/i) ||
                    trimmed.match(/tasa.*(?:éxito|acierto)[:\s]*(\d+(?:\.\d+)?)\s*%?/i);
    if (wrMatch) win_rate = parseFloat(wrMatch[1]);

    const titleMatch = trimmed.match(/^(?:\d+[\.\)]\s+)?(?:\*\*)?([^*\n]{8,80})(?:\*\*)?/);
    if (!titleMatch) continue;

    const title = titleMatch[1].replace(/\*\*/g, "").replace(/^#+\s*/, "").replace(/^[-•]\s*/, "").trim();
    if (/^(veredicto|verdict|resumen ejecutivo|win rate|backtest|capa \d|layer \d|hipótesis|patrones detectados)/i.test(title)) continue;
    if (/^\*\s*(Confianza|Título|Fuente|Evidencia)/i.test(title)) continue;

    const descLines = trimmed.split("\n").slice(1);
    let description = "";
    let confidence = 70;
    let sources: string[] = [];
    let contrary_evidence: string | undefined;

    for (const line of descLines) {
      const l = line.trim();
      const confMatch = l.match(/confianza[:\s]*(\d+)/i) || l.match(/confidence[:\s]*(\d+)/i);
      if (confMatch) { confidence = parseInt(confMatch[1], 10); continue; }
      const srcMatch = l.match(/fuente[s]?[:\s]*(.*)/i) || l.match(/source[s]?[:\s]*(.*)/i);
      if (srcMatch) { sources = srcMatch[1].split(",").map(s => s.trim().replace(/\*\*/g, "")).filter(Boolean); continue; }
      const ceMatch = l.match(/evidencia contraria[:\s]*(.*)/i) || l.match(/contrary[:\s]*(.*)/i);
      if (ceMatch) { contrary_evidence = ceMatch[1].trim(); continue; }
      if (/^\*\s*(Confianza|Título|Fuente|Win Rate|Backtest)/i.test(l)) continue;
      if (l.length > 5) description += (description ? " " : "") + l.replace(/^\*\s*/, "").replace(/\*\*/g, "");
    }

    if (title.length > 5) patterns.push({ title, confidence, description: description.trim(), sources, contrary_evidence });
  }

  if (patterns.length === 0 && answer.trim()) {
    const paragraphs = answer.split(/\n\n+/).filter(p => p.trim().length > 30);
    for (const para of paragraphs.slice(0, 8)) {
      const firstLine = para.trim().split("\n")[0].replace(/[#*\-]/g, "").trim();
      const rest = para.trim().split("\n").slice(1).join(" ").replace(/\*\*/g, "").trim();
      if (firstLine.length > 5 && firstLine.length < 100) {
        patterns.push({ title: firstLine.slice(0, 80), confidence: 70, description: rest || firstLine, sources: [] });
      }
    }
    if (patterns.length === 0) {
      patterns.push({ title: "Análisis general", confidence: 70, description: answer.slice(0, 800).replace(/\*\*/g, ""), sources: ["Expert Forge MoE"] });
    }
  }

  return { verdict, win_rate, patterns };
}

function ConfidencePill({ value }: { value: number }) {
  const tone = value >= 80 ? "acc-4" : value >= 60 ? "acc-5" : "acc-3";
  const label = value >= 80 ? "Alta" : value >= 60 ? "Media" : "Baja";
  return (
    <span className="chip shrink-0 num-display" style={{ borderColor: `hsl(var(--${tone}) / 0.35)`, color: `hsl(var(--${tone}))` }}>
      <span className="chip-dot" style={{ background: `hsl(var(--${tone}))` }} /> {value}% · {label}
    </span>
  );
}

function PatternCard({ pattern, defaultOpen = false, accent }: { pattern: Pattern; defaultOpen?: boolean; accent: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass glass-accent p-4" style={{ ["--acc-line" as any]: `var(--${accent})` }}>
      <button onClick={() => setOpen(!open)} className="flex items-start justify-between gap-3 w-full text-left">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-sm leading-snug tracking-tight">{pattern.title}</h3>
          {!open && pattern.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pattern.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <ConfidencePill value={pattern.confidence} />
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1">Descripción</p>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {pattern.description || "Sin descripción disponible."}
            </p>
          </div>
          {pattern.sources.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1">Fuentes</p>
              <div className="flex flex-wrap gap-1">
                {pattern.sources.map((s, i) => <span key={i} className="chip">{s}</span>)}
              </div>
            </div>
          )}
          {pattern.contrary_evidence && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-[10px] uppercase tracking-widest text-destructive mb-1 font-semibold">⚠ Evidencia contraria</p>
              <p className="text-xs">{pattern.contrary_evidence}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Patrones() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PatternResult | null>(null);
  const [rawAnswer, setRawAnswer] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("ai_agent_tasks").select("resultado")
          .eq("agente_tipo", "patrones_cache").order("created_at", { ascending: false }).limit(1).single();
        if (data?.resultado) {
          const cached = data.resultado as any;
          if (cached.parsed) setResult(cached.parsed);
          if (cached.raw) setRawAnswer(cached.raw);
        }
      } catch {}
    })();
  }, []);

  const saveToDb = async (parsed: PatternResult, raw: string) => {
    try {
      await supabase.from("ai_agent_tasks").delete().eq("agente_tipo", "patrones_cache");
      await supabase.from("ai_agent_tasks").insert({
        agente_tipo: "patrones_cache", estado: "completado",
        resultado: { parsed, raw } as any, creado_por: user?.id || null,
      });
    } catch {}
  };

  const fetchPatterns = async () => {
    setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ava-orchestrator", {
        body: {
          message: `Analiza los datos disponibles y detecta patrones relevantes para el negocio. 
Para cada patrón devuelve en formato estructurado:
1. Título claro y descriptivo (máximo 10 palabras)
2. Confianza: porcentaje (0-100)
3. Descripción: 2-4 frases
4. Fuentes
5. Evidencia contraria si la hay
Devuelve también un veredicto general y el win rate del backtest si está disponible.
Mínimo 3 patrones, máximo 8.`,
          history: [],
        },
      });
      if (error) throw new Error(error.message);
      const answer = data?.answer || data?.error || "Sin respuesta";
      setRawAnswer(answer);
      const parsed = parsePatterns(answer);
      setResult(parsed);
      await saveToDb(parsed, answer);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const openAvaWithPatterns = () => {
    sessionStorage.setItem("ava-preload-prompt", "Analiza los patrones detectados en profundidad. ¿Cuáles tienen mayor probabilidad de éxito y por qué?");
    navigate("/asistente");
  };

  const accents = ["acc-1", "acc-2", "acc-3", "acc-4", "acc-5"];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">Inteligencia · Patrones</p>
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
              <span className="text-iridescent">Patrones</span> detectados
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Señales y tendencias detectadas por los especialistas IA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchPatterns} disabled={loading} size="sm" className="rounded-2xl gradient-iridescent text-white border-0 hover:opacity-95">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {result ? "Actualizar" : "Cargar patrones"}
            </Button>
            <Button variant="outline" size="sm" className="rounded-2xl border-border/40" onClick={openAvaWithPatterns}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Consultar AVA
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass p-4 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {result && (
        <div className="glass-strong glass-accent p-4 md:p-5" style={{ ["--acc-line" as any]: "var(--acc-2)" }}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--acc-4))" }} />
              <span className="text-sm">
                <span className="text-muted-foreground">Veredicto: </span>
                <span className="font-medium text-foreground">{result.verdict || "Sin veredicto"}</span>
              </span>
            </div>
            {result.win_rate != null && (
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--acc-5))" }} />
                <span className="text-sm">
                  <span className="text-muted-foreground">Win Rate: </span>
                  <span className="font-display font-semibold num-display">{result.win_rate}%</span>
                </span>
              </div>
            )}
            <span className="chip ml-auto">{result.patterns.length} patrones</span>
          </div>
        </div>
      )}

      {/* Pattern cards */}
      {result && (
        <div className="space-y-3">
          {result.patterns.map((p, idx) => (
            <PatternCard key={idx} pattern={p} defaultOpen={idx === 0} accent={accents[idx % accents.length]} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && (
        <div className="glass p-16 text-center">
          <div className="relative inline-grid place-items-center">
            <div className="absolute inset-0 gradient-iridescent rounded-full blur-2xl opacity-40" />
            <div className="relative h-16 w-16 rounded-3xl gradient-iridescent grid place-items-center glow-ring">
              <Brain className="h-7 w-7 text-white" />
            </div>
          </div>
          <h3 className="font-display font-semibold text-lg mt-5 tracking-tight">Sin patrones cargados</h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
            Pulsa "Cargar patrones" para que la IA analice los datos y detecte tendencias relevantes.
          </p>
        </div>
      )}
    </div>
  );
}
