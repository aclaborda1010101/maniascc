import { useState, useRef } from "react";
import { Paperclip, X, Loader2, FileText, ImageIcon, Sheet, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AvaAttachment } from "@/services/avaAttachmentService";

interface Props {
  attachments: AvaAttachment[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.json,.xlsx,.xls,.docx,.doc,.pptx";
const MAX_BYTES = 20 * 1024 * 1024;

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return Sheet;
  if (mime === "application/pdf" || mime.includes("word") || mime.includes("officedocument")) return FileText;
  return File;
}

export function AvaAttachmentBar({ attachments, onAdd, onRemove, disabled, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files).filter(f => {
      if (f.size > MAX_BYTES) return false;
      return true;
    });
    if (arr.length === 0) return;
    onAdd(arr);
  };

  return (
    <div
      className={cn("space-y-2", dragOver && "ring-2 ring-accent rounded-lg")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map(a => {
            const Icon = iconFor(a.mime_type);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded border bg-muted/50 max-w-[200px]",
                  compact ? "text-[10px]" : "text-xs",
                  a.status === "error" && "border-destructive bg-destructive/10",
                )}
                title={a.error || a.file_name}
              >
                {a.status === "uploading" || a.status === "processing" ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{a.file_name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => onRemove(a.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(compact ? "h-8 w-8" : "h-9 w-9", "shrink-0 text-muted-foreground hover:text-foreground")}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Adjuntar archivo (PDF, Excel, Word, imagen)"
      >
        <Paperclip className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>
    </div>
  );
}
