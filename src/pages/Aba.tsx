import { useRef, useState } from "react";
import { Send, Trash2, ShoppingBag, User, Plus, Pencil, Check, X as XIcon, MessageSquare, FileDown, Loader2, PanelLeftOpen, Paperclip, Mic, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAbaChat, abaToolLabel } from "@/hooks/useAbaChat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { generateProfessionalPdf, downloadBlob } from "@/services/pdfService";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

function PdfDownloadButton({ content, title }: { content: string; title?: string }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const handleClick = async () => {
    setExporting(true);
    const docTitle = title || "Informe ABA";
    const { blob, error } = await generateProfessionalPdf(docTitle, content, "ABA");
    if (blob) {
      downloadBlob(blob, `${docTitle}.pdf`);
      toast({ title: "PDF descargado" });
    } else {
      toast({ title: "Error", description: error, variant: "destructive" });
    }
    setExporting(false);
  };
  return (
    <Button variant="outline" size="sm" className="mt-2 gap-1.5 text-xs h-7 px-3 border-accent text-accent" onClick={handleClick} disabled={exporting}>
      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Descargar informe PDF
    </Button>
  );
}

function ConversationList(props: any) {
  const { conversations, activeConversationId, editingId, editTitle,
    onSwitch, onStartRename, onConfirmRename, onCancelRename, onEditTitleChange,
    onDelete, onCreate } = props;
  const sortedConvs = [...conversations].sort((a: any, b: any) => b.updatedAt - a.updatedAt);
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Button onClick={onCreate} variant="outline" size="sm" className="w-full gap-2">
          <Plus className="h-4 w-4" /> Nueva conversación
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sortedConvs.map((conv: any) => (
          <div
            key={conv.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 hover:bg-muted/60 transition-colors min-h-[44px]",
              conv.id === activeConversationId && "bg-muted"
            )}
            onClick={() => conv.id !== activeConversationId && onSwitch(conv.id)}
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            {editingId === conv.id ? (
              <div className="flex-1 flex items-center gap-1">
                <Input value={editTitle} onChange={(e: any) => onEditTitleChange(e.target.value)}
                  onKeyDown={(e: any) => e.key === "Enter" && onConfirmRename()}
                  className="h-6 text-xs px-1" autoFocus
                  onClick={(e: any) => e.stopPropagation()} />
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e: any) => { e.stopPropagation(); onConfirmRename(); }}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e: any) => { e.stopPropagation(); onCancelRename(); }}>
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs truncate">{conv.title}</span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e: any) => { e.stopPropagation(); onStartRename(conv.id, conv.title); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e: any) => { e.stopPropagation(); onDelete(conv.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Aba() {
  const {
    conversations, activeConversationId, messages, input, setInput,
    attachments, addAttachment, removeAttachment,
    loading, sendMessage, clearChat, scrollRef,
    createConversation, switchConversation, renameConversation, deleteConversation,
  } = useAbaChat();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRename = (id: string, t: string) => { setEditingId(id); setEditTitle(t); };
  const confirmRename = () => {
    if (editingId && editTitle.trim()) renameConversation(editingId, editTitle.trim());
    setEditingId(null);
  };

  const handleSwitch = (id: string) => {
    switchConversation(id);
    if (isMobile) setSidebarOpen(false);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) await addAttachment(files[i]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const convListProps = {
    conversations, activeConversationId, editingId, editTitle,
    onSwitch: handleSwitch, onStartRename: startRename,
    onConfirmRename: confirmRename, onCancelRename: () => setEditingId(null),
    onEditTitleChange: setEditTitle, onDelete: deleteConversation,
    onCreate: () => { createConversation(); if (isMobile) setSidebarOpen(false); },
  };

  return (
    <div className="flex h-[calc(100vh-6.5rem)] gap-0 -mx-4 md:-mx-0 -mt-4 md:-mt-0">
      {!isMobile && (
        <div className="w-64 shrink-0 border-r border-border bg-muted/30">
          <ConversationList {...convListProps} />
        </div>
      )}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <ConversationList {...convListProps} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-3 md:px-6 py-2.5 md:py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen(true)}>
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 md:h-5 md:w-5 text-accent" /> ABA
              </h1>
              <p className="text-[10px] md:text-xs text-muted-foreground">Asistente de centros comerciales</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1 text-muted-foreground text-xs">
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Limpiar chat</span>
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 md:space-y-4 p-3 md:p-6 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <ShoppingBag className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/20 mb-4" />
              <h2 className="text-base md:text-lg font-semibold text-muted-foreground">Pregúntame sobre centros comerciales</h2>
              <p className="text-xs md:text-sm text-muted-foreground/60 max-w-md mt-1">
                Tenant mix, comparables, entorno, operadores, comercialización. Adjunta imágenes (planta, foto, mapa) o audios (visita, llamada).
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 md:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <ShoppingBag className="h-3.5 w-3.5 md:h-4 md:w-4 text-accent" />
                </div>
              )}
              <div className={`max-w-[90%] md:max-w-[85%] rounded-xl px-3 py-2.5 md:px-4 md:py-3 ${
                msg.role === "user" ? "bg-accent text-accent-foreground" : "bg-card border border-border shadow-sm"
              }`}>
                {msg.role === "assistant" ? (
                  <div>
                    <div className="ava-report prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.meta?.pdf_content && (
                      <PdfDownloadButton content={msg.meta.pdf_content} title={msg.meta.pdf_title} />
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs md:text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.meta?.attachments?.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px] md:text-[10px]">
                        {a.kind === "image" ? "🖼️" : "🎙️"} {a.name || a.kind}
                      </Badge>
                    ))}
                  </div>
                )}
                {msg.role === "assistant" && msg.meta && (
                  <div className="mt-1.5 md:mt-2 flex flex-wrap gap-1">
                    {msg.meta.tools_used?.map((t: string, i: number) => {
                      const tl = abaToolLabel(t);
                      return <Badge key={i} variant="outline" className="text-[9px] md:text-[10px]">{tl.emoji} {tl.label}</Badge>;
                    })}
                    {msg.meta.latency_ms && (
                      <Badge variant="outline" className="text-[9px] md:text-[10px]">⏱ {msg.meta.latency_ms}ms</Badge>
                    )}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-accent flex items-center justify-center">
                  <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-accent-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 md:gap-3">
              <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <ShoppingBag className="h-3.5 w-3.5 md:h-4 md:w-4 text-accent animate-pulse" />
              </div>
              <Skeleton className="h-16 w-48 md:w-64 rounded-xl" />
            </div>
          )}
        </div>

        <div className="border-t border-border px-3 md:px-6 py-3 md:py-4 shrink-0 space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-[10px] md:text-xs pl-1.5 pr-1 py-0.5">
                  {a.kind === "image" ? <ImageIcon className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                  <span className="truncate max-w-[140px]">{a.name || a.kind}</span>
                  <button onClick={() => removeAttachment(i)} className="hover:bg-destructive/20 rounded p-0.5">
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,audio/*" multiple className="hidden" onChange={onPickFile} />
            <Button variant="outline" size="icon" className="h-9 w-9 md:h-10 md:w-10" onClick={() => fileInputRef.current?.click()} disabled={loading} title="Adjuntar imagen o audio">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Pregúntame sobre centros, operadores, tenant mix..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button onClick={sendMessage} disabled={loading || (!input.trim() && attachments.length === 0)} size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90 h-9 w-9 md:h-10 md:w-10">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
