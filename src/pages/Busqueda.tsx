import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Users, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Busqueda() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ locales: any[]; operadores: any[]; matches: any[] }>({ locales: [], operadores: [], matches: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const [localesRes, operadoresRes, matchesRes] = await Promise.all([
      supabase.from("locales").select("*").or(`nombre.ilike.%${query}%,direccion.ilike.%${query}%,codigo_postal.ilike.%${query}%`).limit(10),
      supabase.from("operadores").select("*").or(`nombre.ilike.%${query}%,sector.ilike.%${query}%`).limit(10),
      supabase.from("matches").select("*, locales(nombre), operadores(nombre)").or(`explicacion.ilike.%${query}%`).limit(10),
    ]);
    setResults({
      locales: localesRes.data || [],
      operadores: operadoresRes.data || [],
      matches: matchesRes.data || [],
    });
    setLoading(false);
  };

  const total = results.locales.length + results.operadores.length + results.matches.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Búsqueda Global</h1>
        <p className="text-muted-foreground">Busca en locales, operadores y matches</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Buscar por nombre, dirección, sector, código postal..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
      </div>

      {loading && <p className="text-muted-foreground animate-pulse">Buscando...</p>}

      {searched && !loading && total === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No se encontraron resultados para "{query}".</CardContent></Card>
      )}

      {results.locales.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-accent" /> Locales ({results.locales.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.locales.map((l) => (
              <Link key={l.id} to={`/locales/${l.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">{l.nombre}</p>
                  <p className="text-sm text-muted-foreground">{l.direccion}, {l.ciudad}</p>
                </div>
                <Badge variant="outline" className="capitalize">{l.estado?.replace("_", " ")}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {results.operadores.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-accent" /> Operadores ({results.operadores.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.operadores.map((o) => (
              <Link key={o.id} to={`/operadores/${o.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">{o.nombre}</p>
                  <p className="text-sm text-muted-foreground">{o.sector}</p>
                </div>
                <Badge variant="secondary">{o.activo ? "Activo" : "Inactivo"}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {results.matches.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-accent" /> Matches ({results.matches.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.matches.map((m) => (
              <div key={m.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{(m.locales as any)?.nombre} ↔ {(m.operadores as any)?.nombre}</p>
                  <Badge className="bg-accent/10 text-accent">{m.score}%</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground truncate">{m.explicacion}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
