import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Users, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const estadoLabels: Record<string, string> = {
  disponible: "Disponible",
  en_negociacion: "En negociación",
  ocupado: "Ocupado",
  reforma: "En reforma",
};

export default function Busqueda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<{ locales: any[]; operadores: any[]; matches: any[] }>({
    locales: [], operadores: [], matches: [],
  });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (q?: string) => {
    const searchTerm = q ?? query;
    if (!searchTerm.trim()) return;
    setLoading(true);
    setSearched(true);
    setSearchParams({ q: searchTerm });

    const [localesRes, operadoresRes, matchesRes] = await Promise.all([
      supabase.from("locales").select("*")
        .or(`nombre.ilike.%${searchTerm}%,direccion.ilike.%${searchTerm}%,codigo_postal.ilike.%${searchTerm}%,ciudad.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false }).limit(15),
      supabase.from("operadores").select("*")
        .or(`nombre.ilike.%${searchTerm}%,sector.ilike.%${searchTerm}%,contacto_nombre.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false }).limit(15),
      supabase.from("matches").select("*, locales(nombre), operadores(nombre)")
        .or(`explicacion.ilike.%${searchTerm}%`)
        .order("score", { ascending: false }).limit(10),
    ]);

    setResults({
      locales: localesRes.data || [],
      operadores: operadoresRes.data || [],
      matches: matchesRes.data || [],
    });
    setLoading(false);
  };

  // Auto-search from URL params
  useEffect(() => {
    if (initialQuery) handleSearch(initialQuery);
  }, []);

  const handleClear = () => {
    setQuery("");
    setSearched(false);
    setResults({ locales: [], operadores: [], matches: [] });
    setSearchParams({});
  };

  const total = results.locales.length + results.operadores.length + results.matches.length + results.farmacias.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Búsqueda Global</h1>
        <p className="text-sm text-muted-foreground">Busca en locales, operadores, matches y farmacias</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10 pr-10"
            placeholder="Buscar por nombre, dirección, sector, código postal..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          {query && (
            <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={() => handleSearch()} className="bg-accent text-accent-foreground hover:bg-accent/90">
          Buscar
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {searched && !loading && (
        <p className="text-sm text-muted-foreground">
          {total} resultado{total !== 1 ? "s" : ""} para "<strong>{searchParams.get("q")}</strong>"
        </p>
      )}

      {searched && !loading && total === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No se encontraron resultados para "{searchParams.get("q")}".</p>
            <p className="text-xs text-muted-foreground mt-1">Prueba con otro término o revisa la ortografía.</p>
          </CardContent>
        </Card>
      )}

      {results.locales.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-accent" /> Locales ({results.locales.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.locales.map((l) => (
              <Link key={l.id} to={`/locales/${l.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l.nombre}</p>
                  <p className="text-sm text-muted-foreground truncate">{l.direccion}, {l.ciudad} — {Number(l.superficie_m2).toLocaleString("es-ES")} m² · {Number(l.precio_renta).toLocaleString("es-ES")} €/mes</p>
                </div>
                <Badge variant="outline" className="shrink-0 ml-3 capitalize">{estadoLabels[l.estado] || l.estado}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {results.operadores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-accent" /> Operadores ({results.operadores.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.operadores.map((o) => (
              <Link key={o.id} to={`/operadores/${o.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.nombre}</p>
                  <p className="text-sm text-muted-foreground">{o.sector} · {Number(o.presupuesto_min).toLocaleString("es-ES")}–{Number(o.presupuesto_max).toLocaleString("es-ES")} €</p>
                </div>
                <Badge variant={o.activo ? "default" : "secondary"} className={`shrink-0 ml-3 ${o.activo ? "bg-chart-2/10 text-chart-2" : ""}`}>
                  {o.activo ? "Activo" : "Inactivo"}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {results.matches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-accent" /> Matches ({results.matches.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.matches.map((m) => (
              <div key={m.id} className="rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <Link to={`/locales/${m.local_id}`} className="text-accent hover:underline">{(m.locales as any)?.nombre}</Link>
                      {" ↔ "}
                      <Link to={`/operadores/${m.operador_id}`} className="text-accent hover:underline">{(m.operadores as any)?.nombre}</Link>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{m.explicacion}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                    <Badge className="bg-accent/10 text-accent">{m.score}%</Badge>
                    <Badge variant="secondary" className="capitalize text-xs">{m.estado}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {results.farmacias.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pill className="h-5 w-5 text-accent" /> Farmacias ({results.farmacias.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.farmacias.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{f.nombre}</p>
                  <p className="text-sm text-muted-foreground">CP: {f.codigo_postal}</p>
                </div>
                {f.riesgo_desabastecimiento && (
                  <Badge variant="secondary" className={
                    f.riesgo_desabastecimiento === "alto" ? "bg-destructive/10 text-destructive" :
                    f.riesgo_desabastecimiento === "medio" ? "bg-chart-3/10 text-chart-3" :
                    "bg-chart-2/10 text-chart-2"
                  }>
                    Riesgo {f.riesgo_desabastecimiento}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
