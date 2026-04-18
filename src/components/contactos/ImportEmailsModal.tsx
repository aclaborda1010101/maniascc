import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Mail, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { parseMboxFile, ingestThreadsInBatches, type EmailThread, type IngestOptions } from "@/services/emailIngestService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Step = "upload" | "review" | "config" | "ingesting" | "done";

export function ImportEmailsModal({ open, onOpenChange, onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [shareLevel, setShareLevel] = useState<"private" | "intel" | "full">("intel");
  const [result, setResult] = useState<{ successful: number; failed: number; errors: string[] } | null>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setThreads([]);
    setProgress({ done: 0, total: 0 });
    setResult(null);
  };

  const handleFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".mbox") && !f.type.includes("mbox")) {
      toast.error("Solo se admiten archivos .mbox por ahora");
      return;
    }
    setFile(f);
    setParsing(true);
    try {
      const parsed = await parseMboxFile(f);
      setThreads(parsed);
      setStep("review");
      toast.success(`${parsed.length} hilos detectados`);
    } catch (e) {
      toast.error(`Error parseando: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setParsing(false);
    }
  };

  const handleIngest = async () => {
    setStep("ingesting");
    setProgress({ done: 0, total: threads.length });

    const options: IngestOptions = {
      visibility_raw: "private",
      visibility_intel: shareLevel === "private" ? "private" : "shared",
      share_extraction: shareLevel !== "private",
    };

    const r = await ingestThreadsInBatches(threads, options, (done, total) => setProgress({ done, total }), 10);
    setResult({ successful: r.totalSuccessful, failed: r.totalFailed, errors: r.errors });
    setStep("done");
    onComplete?.();
  };

  const totalMessages = threads.reduce((s, t) => s + t.messages.length, 0);
  const totalParticipants = new Set(threads.flatMap((t) => t.participants.map((p) => p.email))).size;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Importar correos masivos
          </DialogTitle>
          <DialogDescription>
            Sube un archivo .mbox exportado de Gmail/Thunderbird/Apple Mail. El sistema extraerá inteligencia (entidades, señales, contactos) y la añadirá al conocimiento del equipo.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 hover:border-primary/40"
          >
            {parsing ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Parseando {file?.name}...</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">Arrastra un archivo .mbox o haz clic</p>
                <p className="text-xs text-muted-foreground">Hasta ~500MB. Procesado por lotes de 10 hilos.</p>
              </>
            )}
            <input ref={inputRef} type="file" accept=".mbox" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/30 p-4">
              <div><p className="text-xs text-muted-foreground">Hilos</p><p className="text-2xl font-semibold">{threads.length}</p></div>
              <div><p className="text-xs text-muted-foreground">Mensajes</p><p className="text-2xl font-semibold">{totalMessages}</p></div>
              <div><p className="text-xs text-muted-foreground">Interlocutores</p><p className="text-2xl font-semibold">{totalParticipants}</p></div>
            </div>

            <div>
              <Label className="mb-3 block">Nivel de compartición</Label>
              <RadioGroup value={shareLevel} onValueChange={(v) => setShareLevel(v as typeof shareLevel)}>
                <div className="flex items-start space-x-3 rounded-md border p-3">
                  <RadioGroupItem value="private" id="r1" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="r1" className="font-medium cursor-pointer">Solo yo (privado)</Label>
                    <p className="text-xs text-muted-foreground mt-1">Tus correos no nutren al equipo. No se hace extracción IA.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-md border border-primary p-3 bg-primary/5">
                  <RadioGroupItem value="intel" id="r2" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="r2" className="font-medium cursor-pointer">Inteligencia compartida (recomendado)</Label>
                    <p className="text-xs text-muted-foreground mt-1">Texto literal queda <strong>privado</strong>. Solo se comparten resúmenes, entidades, señales y stats de contacto.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-md border p-3">
                  <RadioGroupItem value="full" id="r3" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="r3" className="font-medium cursor-pointer">Compartir todo</Label>
                    <p className="text-xs text-muted-foreground mt-1">El equipo puede leer también el texto literal. Solo si el buzón es realmente compartido (no personal).</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleIngest}>Iniciar importación</Button>
            </div>
          </div>
        )}

        {step === "ingesting" && (
          <div className="space-y-4 py-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium mt-3">Procesando lote {Math.ceil(progress.done / 10)} de {Math.ceil(progress.total / 10)}</p>
              <p className="text-xs text-muted-foreground">{progress.done} / {progress.total} hilos</p>
            </div>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
            <p className="text-xs text-center text-muted-foreground">No cierres esta ventana. Tiempo estimado: ~{Math.max(1, Math.round((progress.total - progress.done) * 0.5 / 60))} min.</p>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              {result.failed === 0 ? (
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              ) : (
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              )}
              <p className="text-lg font-semibold mt-3">Importación completada</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.successful} hilos exitosos · {result.failed} fallidos
              </p>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-xs max-h-32 overflow-auto">
                {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-destructive">{e}</p>)}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Importar otro</Button>
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
