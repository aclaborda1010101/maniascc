import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Inbox, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export interface ContactMessage {
  id: string;
  channel: string;
  direction: "in" | "out";
  from_email?: string | null;
  from_name?: string | null;
  subject?: string | null;
  body_snippet?: string | null;
  body_text?: string | null;
  sent_at: string;
  sentiment?: "good" | "neutral" | "bad" | null;
}

interface Props {
  messages: ContactMessage[];
  onSync?: () => void;
  syncing?: boolean;
}

const channelIcon: Record<string, typeof Mail> = {
  email_outlook: Mail,
  email_gmail: Mail,
  whatsapp: MessageCircle,
  manual: Inbox,
};

const channelLabel: Record<string, string> = {
  email_outlook: "Outlook",
  email_gmail: "Gmail",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

const sentimentDot: Record<string, string> = {
  good: "bg-emerald-400",
  neutral: "bg-muted-foreground/40",
  bad: "bg-rose-400",
};

export function ConversacionFeed({ messages, onSync, syncing }: Props) {
  const [filter, setFilter] = useState<"all" | "email" | "whatsapp">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = messages.filter((m) => {
    if (filter === "all") return true;
    if (filter === "email") return m.channel.startsWith("email");
    return m.channel === "whatsapp";
  });

  return (
    <Card className="p-4 bg-card/40 backdrop-blur-md border-border/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Conversaciones</h3>
          <span className="text-xs text-muted-foreground">
            ({filtered.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "email", "whatsapp"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                filter === f
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todo" : f === "email" ? "Email" : "WhatsApp"}
            </button>
          ))}
          {onSync && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSync}
              disabled={syncing}
              className="h-7 gap-1 ml-1"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              <span className="text-xs">Sync</span>
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            Sin mensajes registrados.
          </p>
          {onSync && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Conecta tu correo y pulsa Sync para cargar el histórico.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
          {filtered.map((m) => {
            const Icon = channelIcon[m.channel] || Mail;
            const isOpen = expanded === m.id;
            const Dir = m.direction === "in" ? ArrowDownLeft : ArrowUpRight;
            return (
              <li
                key={m.id}
                className="rounded-md border border-border/40 bg-background/40 hover:bg-background/60 transition-colors"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                  className="w-full text-left p-2.5"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <Dir
                      className={`h-3 w-3 flex-shrink-0 ${
                        m.direction === "in"
                          ? "text-accent"
                          : "text-muted-foreground"
                      }`}
                    />
                    {m.sentiment && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          sentimentDot[m.sentiment]
                        }`}
                      />
                    )}
                    <span className="font-medium truncate flex-1">
                      {m.subject || m.body_snippet?.slice(0, 60) || "(sin asunto)"}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                      {formatDistanceToNow(new Date(m.sent_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  </div>
                  {!isOpen && m.body_snippet && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 pl-6">
                      {m.body_snippet}
                    </p>
                  )}
                </button>
                {isOpen && (
                  <div className="px-2.5 pb-2.5 pl-8 text-xs text-foreground/90 border-t border-border/30 pt-2">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                      <span>{channelLabel[m.channel]}</span>
                      <span>·</span>
                      <span>{m.from_name || m.from_email}</span>
                      <span>·</span>
                      <span>
                        {format(new Date(m.sent_at), "d MMM yyyy HH:mm", {
                          locale: es,
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {(m.body_text || m.body_snippet || "").slice(0, 2000)}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
