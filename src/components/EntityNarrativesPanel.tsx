import { useEffect, useState, useCallback, useMemo, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  BookText,
  Loader2,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Handshake,
  StickyNote,
  Heart,
  Info,
  X as XIcon,
  Globe,
  Lock,
  Tag,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export type NarrativeEntityType =
  | "operador"
  | "contacto"
  | "activo"
  | "proyecto"
  | "subdivision";

/** 7 tipos alineados con entity_narratives_tipo_check (constraint actual). */
export type NarrativeTipo =
  | "historia"
  | "experiencia_buena"
  | "experiencia_mala"
  | "negociacion"
  | "nota"
  | "relacion_personal"
  | "contexto";

export type NarrativeVisibility = "shared" | "private";

interface NarrativeRow {
  id: string;
  entity_type: NarrativeEntityType;
  entity_id: string;
  tipo: NarrativeTipo;
  narrativa: string;
  autor_id: string | null;
  created_at: string;
  tags: string[] | null;
  visibility: NarrativeVisibility;
  autor_nombre?: string | null;
}

interface Props {
  entityType: NarrativeEntityType;
  entityId: string;
  className?: string;
}

const TIPO_META: Record<
  NarrativeTipo,
  { label: string; icon: typeof BookText; color: string }
> = {
  historia: {
    label: "Historia",
    icon: BookText,
    color: "bg-primary/15 text-primary border-primary/30",
  },
  experiencia_buena: {
    label: "Experiencia +",
    icon: ThumbsUp,
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  experiencia_mala: {
    label: "Experiencia −",
    icon: ThumbsDown,
    color: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
  negociacion: {
    label: "Negociación",
    icon: Handshake,
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  nota: {
    label: "Nota",
    icon: StickyNote,
    color:
      "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  },
  relacion_personal: {
    label: "Relación personal",
    icon: Heart,
    color: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  },
  contexto: {
    label: "Contexto",
    icon: Info,
    color: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  },
};

/** `relacion_personal` por defecto privada; el resto compartidas. */
function defaultVisibility(t: NarrativeTipo): NarrativeVisibility {
  return t === "relacion_personal" ? "private" : "shared";
}

export function EntityNarrativesPanel({
  entityType,
  entityId,
  className,
}: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<NarrativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Composer
  const [tipo, setTipo] = useState<NarrativeTipo>("nota");
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState<NarrativeVisibility>("shared");

  // Filtros
  const [filterTipo, setFilterTipo] = useState<NarrativeTipo | "all">("all");
  const [filterVisibility, setFilterVisibility] = useState<
    NarrativeVisibility | "all"
  >("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entity_narratives")
      .select(
        "id, entity_type, entity_id, tipo, narrativa, autor_id, created_at, tags, visibility"
      )
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load narratives:", error);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as unknown as NarrativeRow[];
    const authorIds = Array.from(
      new Set(rows.map((r) => r.autor_id).filter(Boolean))
    ) as string[];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("perfiles")
        .select("user_id, nombre, email")
        .in("user_id", authorIds);
      const nameMap = new Map(
        (profiles || []).map((p: any) => [
          p.user_id as string,
          (p.nombre as string) || (p.email as string) || "",
        ])
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

  // Cuando el usuario cambia el tipo, ajustamos visibility por defecto
  // pero solo si no la ha tocado explícitamente (heurística simple:
  // si está en el default del tipo previo, la actualizamos).
  const handleTipoChange = (next: NarrativeTipo) => {
    if (visibility === defaultVisibility(tipo)) {
      setVisibility(defaultVisibility(next));
    }
    setTipo(next);
  };

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t].slice(0, 8));
    setTagInput("");
  };

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSave = async () => {
    const narrativa = text.trim();
    if (!narrativa) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "ava-execute-action",
        {
          body: {
            table: "entity_narratives",
            action: "insert",
            data: {
              entity_type: entityType,
              entity_id: entityId,
              tipo,
              narrativa,
              tags,
              visibility,
            },
          },
        }
      );
      if (error || (data && data.error)) {
        const msg =
          (data && data.error) || error?.message || "Error guardando narrativa";
        toast({
          title: "No se pudo guardar",
          description: msg,
          variant: "destructive",
        });
        return;
      }
      setText("");
      setTags([]);
      setTagInput("");
      setTipo("nota");
      setVisibility("shared");
      toast({
        title: "Narrativa guardada",
        description: "Indexada y disponible para AVA.",
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  // Sugerencias de tags: agregamos los tags ya usados en este entity.
  const tagSuggestions = useMemo(() => {
    const all = new Set<string>();
    items.forEach((it) => (it.tags || []).forEach((t) => all.add(t)));
    return Array.from(all).slice(0, 12);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterTipo !== "all" && it.tipo !== filterTipo) return false;
      if (filterVisibility !== "all" && it.visibility !== filterVisibility)
        return false;
      return true;
    });
  }, [items, filterTipo, filterVisibility]);

  return (
    <Card
      className={`p-4 space-y-4 bg-card/40 backdrop-blur-md border-border ${
        className || ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Narrativas y memoria</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtros */}
          <Select
            value={filterTipo}
            onValueChange={(v) => setFilterTipo(v as any)}
          >
            <SelectTrigger className="h-7 text-[11px] w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos los tipos
              </SelectItem>
              {(Object.keys(TIPO_META) as NarrativeTipo[]).map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {TIPO_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterVisibility}
            onValueChange={(v) => setFilterVisibility(v as any)}
          >
            <SelectTrigger className="h-7 text-[11px] w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todas
              </SelectItem>
              <SelectItem value="shared" className="text-xs">
                Compartidas
              </SelectItem>
              <SelectItem value="private" className="text-xs">
                Privadas
              </SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[10px]">
            {filtered.length}/{items.length}
          </Badge>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {items.length === 0
            ? "Sin historias ni notas todavía. Lo que añadas aquí AVA lo recuerda."
            : "Ninguna narrativa coincide con los filtros."}
        </p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filtered.map((it) => {
            const meta = TIPO_META[it.tipo];
            const Icon = meta?.icon || BookText;
            return (
              <div
                key={it.id}
                className="p-3 rounded-lg border border-border/60 bg-background/40 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[10px] gap-1 ${meta?.color || ""}`}
                    >
                      <Icon className="h-3 w-3" /> {meta?.label || it.tipo}
                    </Badge>
                    {it.visibility === "private" ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 bg-muted/40"
                        title="Privada (solo tú o admin)"
                      >
                        <Lock className="h-3 w-3" /> privada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 bg-muted/20"
                        title="Compartida con el equipo"
                      >
                        <Globe className="h-3 w-3" /> compartida
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(it.created_at), {
                      addSuffix: true,
                      locale: es,
                    })}
                    {it.autor_nombre ? ` · ${it.autor_nombre}` : ""}
                  </span>
                </div>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">
                  {it.narrativa}
                </p>
                {it.tags && it.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {it.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[10px] bg-accent/5 border-accent/20"
                      >
                        #{t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex gap-2 flex-wrap">
          <Select value={tipo} onValueChange={(v) => handleTipoChange(v as NarrativeTipo)}>
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
          <Select
            value={visibility}
            onValueChange={(v) => setVisibility(v as NarrativeVisibility)}
          >
            <SelectTrigger className="h-8 text-xs w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shared" className="text-xs">
                🌐 Compartida
              </SelectItem>
              <SelectItem value="private" className="text-xs">
                🔒 Privada
              </SelectItem>
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

        {/* Tags */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {tags.map((t) => (
              <Badge
                key={t}
                variant="outline"
                className="text-[10px] gap-1 bg-accent/10 border-accent/30"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="hover:text-foreground"
                  aria-label={`quitar ${t}`}
                >
                  <XIcon className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              placeholder="añade tag…"
              className="h-6 text-[11px] w-[120px] bg-background/60"
            />
          </div>
          {tagSuggestions.length > 0 && tags.length === 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-muted-foreground">
                sugerencias:
              </span>
              {tagSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
                  className="text-[10px] text-muted-foreground hover:text-foreground border border-border/40 rounded px-1.5 py-0.5"
                >
                  #{s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="gap-1 h-8 text-xs"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Guardar narrativa
          </Button>
        </div>
      </div>
    </Card>
  );
}
