import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, MessageCircle, Mail, Mic, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/* ── Shared DropZone ── */
function DropZone({ accept, label, icon: Icon, onFile }: {
  accept: string; label: string; icon: React.ElementType; onFile: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/40"
      }`}
    >
      <Icon className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60">Arrastra o haz clic para seleccionar</p>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

/* ── Column mapping ── */
const TARGET_COLS = [
  { key: "skip", label: "— Ignorar —" },
  { key: "nombre", label: "Nombre" },
  { key: "apellidos", label: "Apellidos" },
  { key: "empresa", label: "Empresa" },
  { key: "cargo", label: "Cargo" },
  { key: "email", label: "Email" },
  { key: "telefono", label: "Teléfono" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "notas_perfil", label: "Notas" },
];

function guessCol(h: string) {
  const l = h.toLowerCase().trim();
  if (/nombre|name|first/i.test(l)) return "nombre";
  if (/apellid|last|surname/i.test(l)) return "apellidos";
  if (/empresa|company|org/i.test(l)) return "empresa";
  if (/cargo|role|position|title/i.test(l)) return "cargo";
  if (/email|correo|mail/i.test(l)) return "email";
  if (/tel|phone|móvil/i.test(l)) return "telefono";
  if (/whatsapp|wa/i.test(l)) return "whatsapp";
  if (/linkedin/i.test(l)) return "linkedin_url";
  if (/nota|note/i.test(l)) return "notas_perfil";
  return "skip";
}

/* ═══ Tab Contactos ═══ */
function TabContactos({ onImported }: { onImported: () => void }) {
  const { user } = useAuth();
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (json.length < 2) { toast.error("Archivo vacío"); return; }
      setHeaders(json[0].map(String));
      setAllRows(json.slice(1).map(r => r.map(String)));
      setMapping(json[0].map(h => guessCol(String(h))));
      setDone(false);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImport = async () => {
    if (!mapping.includes("nombre")) { toast.error("Mapea al menos 'Nombre'"); return; }
    setImporting(true);
    const inserts = allRows.map((r) => {
      const obj: any = { creado_por: user?.id };
      mapping.forEach((key, i) => { if (key !== "skip" && r[i]) obj[key] = String(r[i]).trim(); });
      return obj;
    }).filter((o) => o.nombre);

    const CHUNK = 100;
    let ok = 0, fail = 0;
    for (let i = 0; i < inserts.length; i += CHUNK) {
      const { error } = await supabase.from("contactos").insert(inserts.slice(i, i + CHUNK) as any);
      if (error) fail += inserts.slice(i, i + CHUNK).length; else ok += inserts.slice(i, i + CHUNK).length;
    }
    setImporting(false);
    if (fail) toast.error(`${fail} filas con error`);
    if (ok) { toast.success(`${ok} contactos importados`); setDone(true); onImported(); }
  };

  if (!headers.length) return <DropZone accept=".csv,.xls,.xlsx,.txt" label="CSV, XLS, XLSX o TXT" icon={FileSpreadsheet} onFile={handleFile} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{allRows.length} filas detectadas</p>
      <div className="rounded-lg border overflow-auto max-h-64">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => (
                <TableHead key={i} className="min-w-[140px]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">{h}</span>
                    <Select value={mapping[i]} onValueChange={(v) => setMapping(p => { const n = [...p]; n[i] = v; return n; })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{TARGET_COLS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allRows.slice(0, 5).map((r, ri) => (
              <TableRow key={ri}>
                {r.map((cell, ci) => <TableCell key={ci} className="text-xs py-1">{cell}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleImport} disabled={importing || done}>
          {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> :
           done ? <><Check className="mr-2 h-4 w-4" />Importado</> : `Importar ${allRows.filter(r => { const ni = mapping.indexOf("nombre"); return ni >= 0 && r[ni]; }).length} contactos`}
        </Button>
        <Button variant="outline" onClick={() => { setHeaders([]); setAllRows([]); setDone(false); }}>Cancelar</Button>
      </div>
    </div>
  );
}

/* ═══ Tab WhatsApp ═══ */
function TabWhatsApp() {
  const [messages, setMessages] = useState<{ date: string; sender: string; text: string }[]>([]);
  const [fileName, setFileName] = useState("");
  const [contactId, setContactId] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const parseWA = useCallback((text: string) => {
    const regex = /(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|AM|PM|[ap]\.m\.)?\s*-\s*([^:]+):\s*(.*)/gi;
    const msgs: { date: string; sender: string; text: string }[] = [];
    let m;
    while ((m = regex.exec(text)) !== null) msgs.push({ date: m[1], sender: m[2].trim(), text: m[3].trim() });
    return msgs;
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setFileName(f.name);
    const parsed = parseWA(await f.text());
    setMessages(parsed);
    if (!parsed.length) toast.error("No se detectaron mensajes en formato WhatsApp");
    const { data } = await supabase.from("contactos").select("id, nombre, apellidos").order("nombre").limit(200);
    setContacts(data || []);
  }, [parseWA]);

  const handleImport = async () => {
    if (!contactId) { toast.error("Selecciona un contacto"); return; }
    setImporting(true);
    await supabase.from("contactos").update({ wa_message_count: messages.length, last_contact: new Date().toISOString() } as any).eq("id", contactId);
    setImporting(false);
    toast.success(`${messages.length} mensajes registrados`);
  };

  if (!fileName) return <DropZone accept=".txt" label="Chat de WhatsApp exportado (.txt)" icon={MessageCircle} onFile={handleFile} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary"><MessageCircle className="mr-1 h-3 w-3" />{fileName}</Badge>
        <span className="text-sm text-muted-foreground">{messages.length} mensajes</span>
      </div>
      {messages.length > 0 && (
        <div className="rounded-lg border max-h-48 overflow-auto p-3 space-y-1">
          {messages.slice(0, 10).map((m, i) => (
            <p key={i} className="text-xs"><span className="font-medium">{m.sender}</span> <span className="text-muted-foreground">({m.date})</span>: {m.text}</p>
          ))}
          {messages.length > 10 && <p className="text-xs text-muted-foreground">... y {messages.length - 10} más</p>}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Vincular a contacto..." /></SelectTrigger>
          <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellidos || ""}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={handleImport} disabled={importing || !contactId}>
          {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> : "Importar mensajes"}
        </Button>
      </div>
    </div>
  );
}

/* ═══ Tab Email ═══ */
function TabEmailImport() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback(async (f: File) => { setFileName(f.name); setContent(await f.text()); }, []);

  const handleImport = async () => {
    if (!content) return;
    setImporting(true);
    const { error } = await supabase.from("documentos_proyecto").insert({
      nombre: fileName || "email-import.eml",
      tipo_documento: "email",
      storage_path: `emails/${Date.now()}_${fileName}`,
      subido_por: user?.id,
      mime_type: "message/rfc822",
    });
    setImporting(false);
    if (error) toast.error(error.message); else toast.success("Email importado como documento");
  };

  if (!fileName) return <DropZone accept=".eml,.txt,.msg" label="Archivo de email (.eml, .txt)" icon={Mail} onFile={handleFile} />;

  return (
    <div className="space-y-4">
      <Badge variant="secondary"><Mail className="mr-1 h-3 w-3" />{fileName}</Badge>
      <div className="rounded-lg border max-h-48 overflow-auto p-3">
        <pre className="text-xs whitespace-pre-wrap">{content.slice(0, 2000)}</pre>
      </div>
      <Button onClick={handleImport} disabled={importing}>
        {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Importar email"}
      </Button>
    </div>
  );
}

/* ═══ Tab Plaud ═══ */
function TabPlaud() {
  const [file, setFile] = useState<File | null>(null);
  const [contactId, setContactId] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState("");

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setPreview(f.name.endsWith(".txt") ? (await f.text()).slice(0, 1000) : `Audio: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`);
    const { data } = await supabase.from("contactos").select("id, nombre, apellidos").order("nombre").limit(200);
    setContacts(data || []);
  }, []);

  const handleImport = async () => {
    if (!file || !contactId) { toast.error("Selecciona archivo y contacto"); return; }
    setImporting(true);
    if (!file.name.endsWith(".txt")) {
      const { error } = await supabase.storage.from("multimedia_locales").upload(`plaud/${Date.now()}_${file.name}`, file);
      if (error) { toast.error(error.message); setImporting(false); return; }
    }
    await supabase.from("contactos").update({ plaud_count: 1, last_contact: new Date().toISOString() } as any).eq("id", contactId);
    setImporting(false);
    toast.success("Grabación/transcripción importada");
  };

  if (!file) return <DropZone accept=".txt,.mp3,.wav,.m4a,.ogg" label="Transcripción (.txt) o audio" icon={Mic} onFile={handleFile} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary"><Mic className="mr-1 h-3 w-3" />{file.name}</Badge>
        <span className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
      </div>
      {preview && <div className="rounded-lg border max-h-48 overflow-auto p-3"><pre className="text-xs whitespace-pre-wrap">{preview}</pre></div>}
      <div className="flex items-center gap-3">
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Vincular a contacto..." /></SelectTrigger>
          <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellidos || ""}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={handleImport} disabled={importing || !contactId}>
          {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> : "Importar grabación"}
        </Button>
      </div>
    </div>
  );
}

/* ═══ Modal principal ═══ */
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

export default function ImportContactosModal({ open, onOpenChange, onImported }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Importar Datos
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="contactos">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contactos" className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> Contactos</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5"><MessageCircle className="h-4 w-4" /> WhatsApp</TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5"><Mail className="h-4 w-4" /> Email</TabsTrigger>
            <TabsTrigger value="plaud" className="gap-1.5"><Mic className="h-4 w-4" /> Plaud</TabsTrigger>
          </TabsList>

          <TabsContent value="contactos"><TabContactos onImported={onImported} /></TabsContent>
          <TabsContent value="whatsapp"><TabWhatsApp /></TabsContent>
          <TabsContent value="email"><TabEmailImport /></TabsContent>
          <TabsContent value="plaud"><TabPlaud /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
