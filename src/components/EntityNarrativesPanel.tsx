import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookText, Loader2, Plus, Sparkles, ThumbsDown, ThumbsUp, Handshake, StickyNote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export type NarrativeEntityType = "operador" | "contacto" | "activo" | "proyecto" | "subdivision";
export type NarrativeTipo = "historia" | "experiencia_buena" | "experiencia_mala" | "negociacion" | "nota";

interface NarrativeRow {
  id: string;
  entity_type: NarrativeEntityType;
  entity_id: string;
  tipo: NarrativeTipo;
  narrativa: string;
  autor_id: string | null;
  created_at: string;
  autor_nombre?: string | null;
}

interface Props {
  entityType: NarrativeEntityType;
  entityId: string;
  className?: string;
}

const TIPO_META: Record<NarrativeTipo, { label: string; icon: typeof BookText; color: string }> = {
  historia: { label: "Historia", icon: BookText, color: "bg-primary/15 text-primary border-primary/30" },
  experiencia_buena: { label: "Experiencia +", icon: ThumbsUp, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  experiencia_mala: { label: "Experiencia −", icon: ThumbsDown, color: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  negociacion: { label: "Negociación", icon: Handshake, color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  nota: { label: "Nota", icon: StickyNote, color: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30" },
};

export function EntityNarrativesPanel({ entityType, entityId, className }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<NarrativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<NarrativeTipo>("nota");
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entity_narratives")
      .select("id, entity_type, entity_id, tipo, narrativa, autor_id, created_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load narratives:", error);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as NarrativeRow[];
    const authorIds = Array.from(new Set(rows.map((r) => r.autor_id).filter(Boolean))) as string[];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("perfiles")
        .select("user_id, nombre, email")
        .in("user_id", authorIds);
      const nameMap = new Map(
        (profiles || []).map((p: any) => [p.user_id as string, (p.nombre as string) || (p.email as string) || ""])
      );
      rows.forEach((r) => {
        r.autor_nombre = r.autor_id ? nameMap.get(r.autor_id) || null : null;
      });
    }
    setItems(rows);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    const narrativa = text.trim();
    if (!narrativa) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("ava-execute-action", {
        body: {
          table: "entity_narratives",
          action: "insert",
          data: { entity_type: entityType, entity_id: entityId, tipo, narrativa },
        },
      });
      if (error || (data && data.error)) {
        const msg = (data && data.error) || error?.message || "Error guardando narrativa";
        toast({ title: "No se pudo guardar", description: msg, variant: "destructive" });
        return;
      }
      setText("");
      setTipo("nota");
      toast({ title: "Narrativa guardada", description: "Indexada y disponible para AVA." });
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={`p-4 space-y-4 bg-card/40 backdrop-blur-md border-border ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Narrativas y memoria</h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {items.length} {items.length === 1 ? "registro" : "registros"}
        </Badge>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Sin historias ni notas todavía. Lo que añadas aquí AVA lo recuerda.
        </p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {items.map((it) => {
            const meta = TIPO_META[it.tipo];
            const Icon = meta?.icon || BookText;
            return (
              <div
                key={it.id}
                className="p-3 rounded-lg border border-border/60 bg-background/40 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`text-[10px] gap-1 ${meta?.color || ""}`}>
                    <Icon className="h-3 w-3" /> {meta?.label || it.tipo}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(it.created_at), { addSuffix: true, locale: es })}
                    {it.autor_nombre ? ` · ${it.autor_nombre}` : ""}
                  </span>
                </div>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">{it.narrativa}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex gap-2">
          <Select value={tipo} onValueChange={(v) => setTipo(v as NarrativeTipo)}>
            <SelectTrigger className="h-8 text-xs w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_META) as NarrativeTipo[]).map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {TIPO_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe una historia, anécdota o nota… (ej: 'la negociación con Aldi en Pinto fue dura porque querían reducir la renta un 15%')"
          rows={3}
          className="text-xs resize-none bg-background/60"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="gap-1 h-8 text-xs"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Guardar narrativa
          </Button>
        </div>
      </div>
    </Card>
  );
}
