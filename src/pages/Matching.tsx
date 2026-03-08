import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { MatchCard } from "@/components/MatchCard";

export default function Matching() {
  const { localId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [local, setLocal] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = async () => {
    const [localRes, matchesRes] = await Promise.all([
      supabase.from("locales").select("*").eq("id", localId).single(),
      supabase.from("matches").select("*, operadores(nombre)").eq("local_id", localId).order("score", { ascending: false }),
    ]);
    setLocal(localRes.data);
    setMatches(matchesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { if (localId) fetchData(); }, [localId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-match", {
        body: { local_id: localId },
      });
      if (error) throw error;
      toast({ title: "Matches generados", description: `${data?.matches?.length || 0} resultados encontrados` });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Error generando matches", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  if (!local) return <p className="text-muted-foreground">Local no encontrado.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/locales/${localId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matching IA</h1>
          <p className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {local.nombre} — {local.direccion}, {local.ciudad}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-6 text-sm">
              <div><span className="text-muted-foreground">Superficie:</span> <strong>{local.superficie_m2} m²</strong></div>
              <div><span className="text-muted-foreground">Renta:</span> <strong>{Number(local.precio_renta).toLocaleString("es-ES")} €/mes</strong></div>
              <div><span className="text-muted-foreground">Estado:</span> <strong className="capitalize">{local.estado?.replace("_", " ")}</strong></div>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {generating ? "Analizando mercado..." : "Generar Matches IA"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {generating && (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground animate-pulse">
            Analizando mercado y buscando operadores compatibles...
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {!generating && matches.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {matches.map((m, i) => (
            <MatchCard key={m.id} match={m} index={i} onUpdate={fetchData} />
          ))}
        </div>
      )}

      {!generating && matches.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              No hay matches para este local. Pulsa "Generar Matches IA" para encontrar operadores compatibles.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
