import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TabWhatsApp({ contacto, onRefresh }: { contacto: any; onRefresh: () => void }) {
  const [messages, setMessages] = useState<{ date: string; sender: string; text: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split("\n");
      const parsed: { date: string; sender: string; text: string }[] = [];
      // WhatsApp export format: [DD/MM/YYYY, HH:MM:SS] Sender: Message
      const regex = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*-?\s*([^:]+):\s*(.+)$/;

      for (const line of lines) {
        const match = line.match(regex);
        if (match) {
          parsed.push({ date: `${match[1]} ${match[2]}`, sender: match[3].trim(), text: match[4].trim() });
        }
      }

      setMessages(parsed);

      // Update message count
      await supabase.from("contactos").update({
        wa_message_count: parsed.length,
        last_contact: new Date().toISOString(),
        interaction_count: (contacto.interaction_count || 0) + parsed.length,
      } as any).eq("id", contacto.id);

      toast({ title: `${parsed.length} mensajes importados` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error al importar", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [contacto, onRefresh, toast]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Conversación WhatsApp</CardTitle>
          <label>
            <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" asChild disabled={importing}>
              <span className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" /> {importing ? "Importando..." : "Importar .txt"}
              </span>
            </Button>
          </label>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="py-8 text-center">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">
                Importa un chat de WhatsApp (.txt) para ver la conversación aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.sender.toLowerCase().includes("tú") || m.sender.toLowerCase().includes("you") ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs ${
                    m.sender.toLowerCase().includes("tú") || m.sender.toLowerCase().includes("you")
                      ? "bg-primary/10 text-foreground" : "bg-muted text-foreground"
                  }`}>
                    <p className="font-medium text-[10px] text-muted-foreground mb-0.5">{m.sender}</p>
                    <p>{m.text}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-0.5 px-1">{m.date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
