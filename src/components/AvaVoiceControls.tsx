import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, Radio, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { speak, stopSpeaking } from "@/lib/speech";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** Append transcribed text to the input */
  onTranscript: (text: string) => void;
  /** Send the current input + close any in-progress speech (used by conversation mode) */
  onAutoSend?: () => Promise<void> | void;
  /** Latest assistant reply to read aloud (only used in conversation mode) */
  latestAssistantReply?: string | null;
  /** Whether AVA is currently generating a reply */
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Two-mode voice control:
 *  • Push-to-talk dictation (mic button): hold-style toggle, transcribes and inserts.
 *  • Conversation mode (radio button): continuous loop record→transcribe→send→TTS→record.
 */
export function AvaVoiceControls({
  onTranscript, onAutoSend, latestAssistantReply, loading, disabled, compact,
}: Props) {
  const { toast } = useToast();
  const [conversationMode, setConversationMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Refs to prevent stale closures inside the conversation loop
  const conversationModeRef = useRef(false);
  const lastSpokenReplyRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const speakingRef = useRef(false);

  useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);
  useEffect(() => { loadingRef.current = !!loading; }, [loading]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);

  const dictation = useVoiceRecorder({
    onTranscript: (text) => onTranscript(text),
  });

  const conversation = useVoiceRecorder({ silent: true });

  const startDictation = async () => {
    if (dictation.status === "recording") {
      await dictation.stop();
    } else {
      stopSpeaking();
      await dictation.start();
    }
  };

  // Conversation loop: record a single utterance, transcribe, send to AVA.
  const captureOnce = async () => {
    if (!conversationModeRef.current) return;
    await conversation.start();

    // Simple silence-based stop: monitor analyser; if no audio detected for 1.5s after speech, stop.
    // Fallback: hard cap 12s.
    await waitForSilenceOrTimeout(12_000);

    if (!conversationModeRef.current) {
      conversation.cancel();
      return;
    }
    const text = await conversation.stop();
    if (!conversationModeRef.current) return;

    if (text && text.length > 0) {
      onTranscript(text);
      // give state time to flush, then auto-send
      setTimeout(() => { onAutoSend?.(); }, 80);
    } else {
      // nothing captured → loop again
      setTimeout(() => { if (conversationModeRef.current) captureOnce(); }, 200);
    }
  };

  // When conversation mode toggled on, start the first capture
  useEffect(() => {
    if (conversationMode && !loading && !speaking) {
      captureOnce();
    }
    if (!conversationMode) {
      conversation.cancel();
      stopSpeaking();
      setSpeaking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationMode]);

  // When a new assistant reply arrives in conversation mode, speak it then resume listening
  useEffect(() => {
    if (!conversationMode) return;
    if (!latestAssistantReply) return;
    if (latestAssistantReply === lastSpokenReplyRef.current) return;
    if (loading) return;

    lastSpokenReplyRef.current = latestAssistantReply;
    setSpeaking(true);
    speak(latestAssistantReply, {
      onEnd: () => {
        setSpeaking(false);
        if (conversationModeRef.current) {
          setTimeout(() => { if (conversationModeRef.current) captureOnce(); }, 250);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAssistantReply, conversationMode, loading]);

  const isRecording = dictation.status === "recording" || conversation.status === "recording";
  const isProcessing = dictation.status === "processing";

  const sizeBtn = compact ? "h-8 w-8" : "h-9 w-9";
  const sizeIcon = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="flex items-center gap-1">
      {/* Dictation mic */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(sizeBtn, "shrink-0",
          dictation.status === "recording" && "text-destructive animate-pulse",
          dictation.status === "idle" && "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => {
          if (conversationMode) {
            toast({ title: "Modo conversación activo", description: "Detén el modo conversación para usar dictado puntual." });
            return;
          }
          startDictation();
        }}
        disabled={disabled || isProcessing || (loading && dictation.status !== "recording")}
        title={dictation.status === "recording" ? "Detener y transcribir" : "Dictar mensaje"}
      >
        {isProcessing ? <Loader2 className={cn(sizeIcon, "animate-spin")} />
          : dictation.status === "recording" ? <MicOff className={sizeIcon} />
          : <Mic className={sizeIcon} />}
      </Button>

      {/* Conversation toggle */}
      <Button
        type="button"
        variant={conversationMode ? "default" : "ghost"}
        size="icon"
        className={cn(sizeBtn, "shrink-0",
          conversationMode && "bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md",
          !conversationMode && "text-muted-foreground hover:text-foreground",
          (conversation.status === "recording" || speaking) && "ring-2 ring-accent/50",
        )}
        onClick={() => setConversationMode(v => !v)}
        disabled={disabled}
        title={conversationMode ? "Detener modo conversación" : "Modo conversación (manos libres)"}
      >
        {conversationMode ? <Square className={sizeIcon} /> : <Radio className={sizeIcon} />}
      </Button>
    </div>
  );
}

/**
 * MVP utterance window: fixed 5s capture (user can re-trigger by speaking again).
 * Future: replace with VAD using AnalyserNode RMS over the recorder's MediaStream.
 */
function waitForSilenceOrTimeout(maxMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, Math.min(maxMs, 5000));
  });
}
