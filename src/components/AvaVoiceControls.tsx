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
          conversationMode && "bg-accent text-accent-foreground hover:bg-accent/90",
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
 * Waits for ~1.5s of silence after some speech, or a hard timeout.
 * MVP heuristic — relies on AnalyserNode RMS over the active stream.
 */
function waitForSilenceOrTimeout(maxMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const startedAt = Date.now();
    let lastVoiceAt = Date.now();
    let everSpoke = false;
    let raf = 0;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let buf: Uint8Array | null = null;

    try {
      const stream = (navigator.mediaDevices as any).__avaActiveStream as MediaStream | undefined;
      // Best-effort: grab the global tracks via the recorder's stream is not exposed,
      // so we just time-box. If AudioContext setup fails, fall back to fixed 4s window.
      if (stream) {
        ctx = new AudioContext();
        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        buf = new Uint8Array(analyser.frequencyBinCount);
      }
    } catch { /* no-op */ }

    const cleanupAndResolve = () => {
      cancelAnimationFrame(raf);
      try { source?.disconnect(); analyser?.disconnect(); ctx?.close(); } catch { /* */ }
      resolve();
    };

    const tick = () => {
      const now = Date.now();
      if (now - startedAt >= maxMs) return cleanupAndResolve();

      if (analyser && buf) {
        analyser.getByteTimeDomainData(buf);
        // Compute simple RMS deviation from 128
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms > 0.04) {
          everSpoke = true;
          lastVoiceAt = now;
        }
        if (everSpoke && (now - lastVoiceAt) > 1500) return cleanupAndResolve();
        if (!everSpoke && now - startedAt > 4000) return cleanupAndResolve(); // user said nothing
      } else {
        // No analyser → wait fixed 4s
        if (now - startedAt > 4000) return cleanupAndResolve();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
