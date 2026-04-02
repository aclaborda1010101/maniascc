import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const TARGET_COLUMNS = [
  { key: "skip", label: "— Ignorar —" },
  { key: "nombre", label: "Nombre", required: true },
  { key: "apellidos", label: "Apellidos" },
  { key: "empresa", label: "Empresa" },
  { key: "cargo", label: "Cargo" },
  { key: "email", label: "Email" },
  { key: "telefono", label: "Teléfono" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "estilo_negociacion", label: "Estilo negociación" },
  { key: "notas_perfil", label: "Notas" },
] as const;

type ColumnKey = (typeof TARGET_COLUMNS)[number]["key"];

function guessColumn(header: string): ColumnKey {
  const h = header.toLowerCase().trim();
  if (/^nombre/i.test(h) || h === "name" || h === "first_name" || h === "first name") return "nombre";
  if (/apellid/i.test(h) || h === "last_name" || h === "last name" || h === "surname") return "apellidos";
  if (/empresa|company|organiz/i.test(h)) return "empresa";
  if (/cargo|puesto|position|title|job/i.test(h)) return "cargo";
  if (/email|correo|e-mail|mail/i.test(h)) return "email";
  if (/tel[eé]fono|phone|whatsapp|móvil|movil|mobile/i.test(h)) return "telefono";
  if (/linkedin/i.test(h)) return "linkedin_url";
  if (/estilo|negociac/i.test(h)) return "estilo_negociacion";
  if (/nota|note|observ|comment/i.test(h)) return "notas_perfil";
  return "skip";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

export default function ImportContactosModal({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnKey[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number }>({ ok: 0, fail: 0 });
  const { toast } = useToast();
  const { user } = useAuth();

  const reset = () => { setStep("upload"); setHeaders([]); setRows([]); setMapping([]); };

  const parseFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv" || ext === "txt") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) { toast({ title: "Archivo vacío o sin datos", variant: "destructive" }); return; }
        const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
        const hdr = lines[0].split(sep).map(c => c.replace(/^"|"$/g, "").trim());
        const data = lines.slice(1).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, "").trim()));
        setHeaders(hdr);
        setRows(data);
        setMapping(hdr.map(guessColumn));
        setStep("map");
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (json.length < 2) { toast({ title: "Archivo vacío o sin datos", variant: "destructive" }); return; }
        const hdr = json[0].map(String);
        const data = json.slice(1).map(r => r.map(String));
        setHeaders(hdr);
        setRows(data);
        setMapping(hdr.map(guessColumn));
        setStep("map");
      };
      reader.readAsArrayBuffer(file);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const hasNombre = mapping.includes("nombre");
  const previewRows = rows.slice(0, 5);

  const handleImport = async () => {
    setImporting(true);
    let ok = 0, fail = 0;
    const batch = rows.map(row => {
      const obj: Record<string, string | null> = { creado_por: user?.id ?? null };
      mapping.forEach((col, i) => {
        if (col !== "skip" && row[i]) obj[col] = row[i];
      });
      return obj;
    }).filter(o => o.nombre);

    const CHUNK = 100;
    for (let i = 0; i < batch.length; i += CHUNK) {
      const slice = batch.slice(i, i + CHUNK);
      const { error } = await supabase.from("contactos").insert(slice as any);
      if (error) fail += slice.length;
      else ok += slice.length;
    }
    setResult({ ok, fail });
    setImporting(false);
    setStep("done");
    if (ok > 0) onImported();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-accent" /> Importar Contactos
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center hover:border-accent/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById("import-file-input")?.click()}
          >
            <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">Arrastra un archivo aquí o haz clic</p>
            <p className="text-sm text-muted-foreground mt-1">CSV, TXT, XLS o XLSX</p>
            <input id="import-file-input" type="file" accept=".csv,.txt,.xls,.xlsx" className="hidden" onChange={handleFileInput} />
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {rows.length} filas detectadas. Asigna cada columna al campo correspondiente.
            </p>

            {!hasNombre && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Debes asignar al menos la columna "Nombre".
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((h, i) => (
                      <TableHead key={i} className="min-w-[140px]">
                        <div className="space-y-1">
                          <span className="text-xs font-mono text-muted-foreground">{h}</span>
                          <Select value={mapping[i]} onValueChange={(v) => {
                            const m = [...mapping];
                            m[i] = v as ColumnKey;
                            setMapping(m);
                          }}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_COLUMNS.map(c => (
                                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="text-xs max-w-[160px] truncate">
                          {cell || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                Mostrando 5 de {rows.length} filas
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleImport} disabled={!hasNombre || importing} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {importing ? "Importando..." : `Confirmar importación (${rows.filter((r) => { const ni = mapping.indexOf("nombre"); return ni >= 0 && r[ni]; }).length} contactos)`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center space-y-3">
            <Check className="mx-auto h-12 w-12 text-chart-2" />
            <p className="text-lg font-semibold">{result.ok} contactos importados</p>
            {result.fail > 0 && (
              <p className="text-sm text-destructive">{result.fail} filas con error</p>
            )}
            <Button onClick={() => { reset(); onOpenChange(false); }}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
