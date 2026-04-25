import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles } from "lucide-react";

interface DocLink {
  id: string;
  rol: string | null;
  inferred?: boolean;
  doc: {
    id: string;
    nombre: string;
    nombre_normalizado: string | null;
    mime_type: string | null;
    fecha_documento: string | null;
    fase_rag: string | null;
    storage_path: string;
  } | null;
}

export function DocumentosLinkeadosList({ operadorId }: { operadorId: string }) {
  const [links, setLinks] = useState<DocLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasInferred, setHasInferred] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      // Cargar nombre del operador para fallback por nombre (paralelo con queries principales)
      const [opRes, linkRes, directRes] = await Promise.all([
        supabase.from("operadores").select("nombre").eq("id", operadorId).single(),
        supabase
          .from("document_links")
          .select(
            "id, rol, doc:documento_id (id, nombre, nombre_normalizado, mime_type, fecha_documento, fase_rag, storage_path)",
          )
          .eq("entity_type", "operador")
          .eq("entity_id", operadorId),
        supabase
          .from("documentos_proyecto")
          .select("id, nombre, nombre_normalizado, mime_type, fecha_documento, fase_rag, storage_path")
          .eq("operador_id", operadorId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const seen = new Set<string>();
      const merged: DocLink[] = [];

      ((linkRes.data as any[]) || []).forEach((l) => {
        if (l.doc && !seen.has(l.doc.id)) {
          seen.add(l.doc.id);
          merged.push({ id: l.id, rol: l.rol, doc: l.doc });
        }
      });
      ((directRes.data as any[]) || []).forEach((d) => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          merged.push({ id: `direct-${d.id}`, rol: "vinculado", doc: d });
        }
      });

      // Fallback por nombre del operador (si hay <5 docs)
      let inferredFlag = false;
      if (merged.length < 5 && opRes.data?.nombre && opRes.data.nombre.length > 3) {
        const { data: byName } = await supabase
          .from("documentos_proyecto")
          .select("id, nombre, nombre_normalizado, mime_type, fecha_documento, fase_rag, storage_path")
          .or(
            `nombre_normalizado.ilike.%${opRes.data.nombre}%,nombre.ilike.%${opRes.data.nombre}%`,
          )
          .order("created_at", { ascending: false })
          .limit(20);
        ((byName as any[]) || []).forEach((d) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            merged.push({ id: `name-${d.id}`, rol: "por nombre", inferred: true, doc: d });
            inferredFlag = true;
          }
        });
      }

      if (!cancel) {
        setLinks(merged);
        setHasInferred(inferredFlag);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [operadorId]);

  return (
    <Card
      className="relative overflow-hidden border-0 backdrop-blur-xl"
      style={{
        backgroundImage:
          "radial-gradient(120% 80% at 100% 0%, hsl(var(--acc-1) / 0.10) 0%, transparent 55%), linear-gradient(180deg, hsl(var(--acc-2) / 0.04) 0%, hsl(200 35% 6% / 0.5) 100%)",
        boxShadow: "0 1px 0 0 hsl(var(--acc-1) / 0.15) inset",
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 backdrop-blur-md">
            <FileText className="h-4 w-4 text-accent" />
          </span>
          Documentos vinculados
          <span className="text-xs font-normal text-muted-foreground">({links.length})</span>
          {hasInferred && (
            <Badge variant="outline" className="ml-auto text-[10px] bg-accent/10 border-accent/30 text-accent">
              <Sparkles className="h-2.5 w-2.5 mr-1" /> + inferidos
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">Sin documentos vinculados.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {links.map((l) => l.doc && (
              <div
                key={l.id}
                className="flex items-center gap-2 rounded-xl border border-border/15 bg-background/30 px-3 py-2"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{l.doc.nombre_normalizado || l.doc.nombre}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {l.rol && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 ${
                          l.inferred
                            ? "bg-accent/10 border-accent/30 text-accent"
                            : "border-border/30"
                        }`}
                      >
                        {l.rol}
                      </Badge>
                    )}
                    {l.doc.fecha_documento && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(l.doc.fecha_documento).toLocaleDateString("es-ES")}
                      </span>
                    )}
                    {l.doc.fase_rag === "indexed" && (
                      <Badge variant="outline" className="text-[10px] h-4 bg-chart-3/10 text-chart-3 border-chart-3/30">
                        RAG
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
