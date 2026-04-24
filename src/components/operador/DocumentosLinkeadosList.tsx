import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface DocLink {
  id: string;
  rol: string | null;
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

  useEffect(() => {
    let cancel = false;
    (async () => {
      // 1) links explícitos (document_links)
      const { data: linkRows } = await supabase
        .from("document_links")
        .select(
          "id, rol, doc:documento_id (id, nombre, nombre_normalizado, mime_type, fecha_documento, fase_rag, storage_path)",
        )
        .eq("entity_type", "operador")
        .eq("entity_id", operadorId);

      // 2) docs vinculados directos vía documentos_proyecto.operador_id
      const { data: directRows } = await supabase
        .from("documentos_proyecto")
        .select("id, nombre, nombre_normalizado, mime_type, fecha_documento, fase_rag, storage_path")
        .eq("operador_id", operadorId)
        .order("created_at", { ascending: false })
        .limit(200);

      const seen = new Set<string>();
      const merged: DocLink[] = [];

      ((linkRows as any[]) || []).forEach((l) => {
        if (l.doc && !seen.has(l.doc.id)) {
          seen.add(l.doc.id);
          merged.push({ id: l.id, rol: l.rol, doc: l.doc });
        }
      });
      ((directRows as any[]) || []).forEach((d) => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          merged.push({ id: `direct-${d.id}`, rol: "vinculado", doc: d });
        }
      });

      if (!cancel) {
        setLinks(merged);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [operadorId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          Documentos vinculados
          <span className="text-xs font-normal text-white/50">({links.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : links.length === 0 ? (
          <p className="text-sm text-white/50 py-3 text-center">Sin documentos vinculados.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {links.map((l) => l.doc && (
              <div
                key={l.id}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2"
              >
                <FileText className="h-4 w-4 text-white/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{l.doc.nombre_normalizado || l.doc.nombre}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {l.rol && <Badge variant="outline" className="text-[10px] h-4">{l.rol}</Badge>}
                    {l.doc.fecha_documento && (
                      <span className="text-[10px] text-white/45">
                        {new Date(l.doc.fecha_documento).toLocaleDateString("es-ES")}
                      </span>
                    )}
                    {l.doc.fase_rag === "indexed" && (
                      <Badge variant="outline" className="text-[10px] h-4 bg-chart-2/10 text-chart-2 border-chart-2/30">
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
