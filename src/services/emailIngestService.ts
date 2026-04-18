import { supabase } from "@/integrations/supabase/client";

export interface EmailMessage {
  from: string;
  to: string[];
  date: string;
  body: string;
}

export interface EmailParticipant {
  email: string;
  name?: string;
  role?: "from" | "to" | "cc";
}

export interface EmailThread {
  thread_external_id?: string;
  subject: string;
  participants: EmailParticipant[];
  messages: EmailMessage[];
  attachments?: { filename: string; mime: string; size: number }[];
}

export interface IngestOptions {
  visibility_raw?: "private" | "shared";
  visibility_intel?: "private" | "shared";
  share_extraction?: boolean;
}

/**
 * Parse a .mbox file (RFC4155) into thread groups.
 * Threads are grouped by normalized subject (Re:/Fwd: stripped) + participant overlap.
 */
export async function parseMboxFile(file: File): Promise<EmailThread[]> {
  const text = await file.text();
  const messages = parseMbox(text);
  return groupIntoThreads(messages);
}

interface RawMessage {
  from: string;
  to: string[];
  cc: string[];
  date: string;
  subject: string;
  body: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
}

function parseMbox(content: string): RawMessage[] {
  // Split on lines beginning with "From " (mbox separator)
  const blocks = content.split(/^From .*$/m).filter((b) => b.trim().length > 0);
  const messages: RawMessage[] = [];

  for (const block of blocks) {
    const headerEnd = block.indexOf("\n\n");
    if (headerEnd === -1) continue;
    const headerText = block.slice(0, headerEnd);
    const body = block.slice(headerEnd + 2).trim();

    const headers: Record<string, string> = {};
    let currentKey = "";
    for (const line of headerText.split("\n")) {
      if (/^\s/.test(line) && currentKey) {
        headers[currentKey] += " " + line.trim();
      } else {
        const idx = line.indexOf(":");
        if (idx > 0) {
          currentKey = line.slice(0, idx).trim().toLowerCase();
          headers[currentKey] = line.slice(idx + 1).trim();
        }
      }
    }

    messages.push({
      from: headers["from"] || "",
      to: parseAddressList(headers["to"] || ""),
      cc: parseAddressList(headers["cc"] || ""),
      date: headers["date"] || new Date().toISOString(),
      subject: headers["subject"] || "(sin asunto)",
      body: body.slice(0, 50000),
      messageId: headers["message-id"],
      inReplyTo: headers["in-reply-to"],
      references: (headers["references"] || "").split(/\s+/).filter(Boolean),
    });
  }

  return messages;
}

function parseAddressList(s: string): string[] {
  return s
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

function normalizeSubject(s: string): string {
  return s.replace(/^(re|fwd|fw|rv)[:\s]+/gi, "").trim().toLowerCase();
}

function extractEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim().toLowerCase();
}

function extractName(addr: string): string | undefined {
  const m = addr.match(/^(.+?)\s*<.+>$/);
  return m ? m[1].replace(/^"|"$/g, "").trim() : undefined;
}

function groupIntoThreads(messages: RawMessage[]): EmailThread[] {
  const threadMap = new Map<string, EmailThread>();

  for (const msg of messages) {
    const key = msg.references?.[0] || msg.inReplyTo || normalizeSubject(msg.subject) || msg.messageId || crypto.randomUUID();

    if (!threadMap.has(key)) {
      threadMap.set(key, {
        thread_external_id: key,
        subject: msg.subject,
        participants: [],
        messages: [],
      });
    }
    const thread = threadMap.get(key)!;

    const fromEmail = extractEmail(msg.from);
    const toEmails = msg.to.map(extractEmail);

    thread.messages.push({
      from: fromEmail,
      to: toEmails,
      date: msg.date,
      body: msg.body,
    });

    const allAddrs = [
      { addr: msg.from, role: "from" as const },
      ...msg.to.map((a) => ({ addr: a, role: "to" as const })),
      ...msg.cc.map((a) => ({ addr: a, role: "cc" as const })),
    ];
    for (const { addr, role } of allAddrs) {
      const email = extractEmail(addr);
      if (!email) continue;
      if (!thread.participants.find((p) => p.email === email)) {
        thread.participants.push({ email, name: extractName(addr), role });
      }
    }
  }

  return Array.from(threadMap.values());
}

export async function ingestThreadBatch(
  threads: EmailThread[],
  options: IngestOptions = {}
): Promise<{ ok: boolean; processed: number; successful: number; failed: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("email-bulk-ingest", {
    body: {
      threads,
      visibility_raw: options.visibility_raw || "private",
      visibility_intel: options.visibility_intel || "shared",
      share_extraction: options.share_extraction !== false,
    },
  });
  if (error) return { ok: false, processed: 0, successful: 0, failed: threads.length, error: error.message };
  if (data?.error) return { ok: false, processed: 0, successful: 0, failed: threads.length, error: data.error };
  return data;
}

export async function ingestThreadsInBatches(
  threads: EmailThread[],
  options: IngestOptions = {},
  onProgress?: (done: number, total: number) => void,
  batchSize = 10
): Promise<{ totalProcessed: number; totalSuccessful: number; totalFailed: number; errors: string[] }> {
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  for (let i = 0; i < threads.length; i += batchSize) {
    const batch = threads.slice(i, i + batchSize);
    const result = await ingestThreadBatch(batch, options);
    totalProcessed += result.processed || 0;
    totalSuccessful += result.successful || 0;
    totalFailed += result.failed || 0;
    if (result.error) errors.push(result.error);
    onProgress?.(Math.min(i + batchSize, threads.length), threads.length);
  }

  return { totalProcessed, totalSuccessful, totalFailed, errors };
}
