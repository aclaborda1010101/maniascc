import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Shield, CheckCircle } from "lucide-react";

export default function Admin() {
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [filterFuncion, setFilterFuncion] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase.from("auditoria_ia").select("*").order("created_at", { ascending: false }).limit(200);
    setLogs(data || []);
    setLogsLoading(false);
  };

  const filteredLogs = logs.filter(l => {
    if (filterFuncion !== "all" && l.funcion_ia !== filterFuncion) return false;
    if (filterDateFrom && new Date(l.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(l.created_at) > new Date(filterDateTo + "T23:59:59")) return false;
    return true;
  });

  const avgLatency = filteredLogs.length > 0 ? Math.round(filteredLogs.reduce((sum, l) => sum + (Number(l.latencia_ms) || 0), 0) / filteredLogs.length) : 0;
  const funciones = [...new Set(logs.map(l => l.funcion_ia).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Administración
        </h1>
        <p className="text-sm text-muted-foreground">Auditoría y configuración del sistema</p>
      </div>

      <Tabs defaultValue="auditoria">
        <TabsList>
          <TabsTrigger value="auditoria" className="gap-1"><Shield className="h-3 w-3" /> Auditoría</TabsTrigger>
          <TabsTrigger value="config" className="gap-1"><Settings className="h-3 w-3" /> Configuración</TabsTrigger>
        </TabsList>

        {/* Tab: Auditoría */}
        <TabsContent value="auditoria" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Operaciones</p><p className="text-2xl font-bold">{filteredLogs.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Tasa de éxito</p><p className="text-2xl font-bold">{filteredLogs.length > 0 ? Math.round((filteredLogs.filter(l => l.exito).length / filteredLogs.length) * 100) : 0}%</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Latencia media</p><p className="text-2xl font-bold">{avgLatency}ms</p></CardContent></Card>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Función</Label>
              <Select value={filterFuncion} onValueChange={setFilterFuncion}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {funciones.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-40" /></div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Operaciones</CardTitle></CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center"><Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-muted-foreground">No hay operaciones registradas.</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Función</TableHead><TableHead>Modelo</TableHead><TableHead>Latencia</TableHead><TableHead>Tokens</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredLogs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.funcion_ia || "—"}</TableCell>
                        <TableCell className="text-xs">{l.modelo}</TableCell>
                        <TableCell>{l.latencia_ms ? `${l.latencia_ms}ms` : "—"}</TableCell>
                        <TableCell className="text-xs">{l.tokens_entrada || 0} → {l.tokens_salida || 0}</TableCell>
                        <TableCell><Badge variant="secondary" className={l.exito ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}>{l.exito ? "OK" : "Error"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("es-ES")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Configuración */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Arquitectura AVA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label className="text-xs text-muted-foreground">Orquestador</Label><p className="text-sm font-mono mt-1">ava-orchestrator</p></div>
                <div><Label className="text-xs text-muted-foreground">RAG interno</Label><p className="text-sm font-mono mt-1">rag-proxy + document_chunks</p></div>
                <div><Label className="text-xs text-muted-foreground">Gateway IA</Label><p className="text-sm font-mono mt-1">Lovable AI Gateway</p></div>
                <div><Label className="text-xs text-muted-foreground">Modelo principal</Label><p className="text-sm font-mono mt-1">google/gemini-2.5-flash</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Funciones de Inteligencia</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { name: "Localización", fn: "ai-localizacion-patrones" },
                  { name: "Tenant Mix", fn: "ai-tenant-mix-avanzado" },
                  { name: "Validación Dossier", fn: "ai-validacion-retorno" },
                  { name: "Perfil Negociador", fn: "ai-perfil-negociador" },
                  { name: "Forge Documentos", fn: "ai-forge" },
                  { name: "Clasificación Documental", fn: "document-classify" },
                  { name: "RAG Ingest", fn: "rag-ingest" },
                  { name: "RAG Proxy", fn: "rag-proxy" },
                ].map(f => (
                  <div key={f.fn} className="rounded-lg border p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{f.fn}</p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-chart-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
