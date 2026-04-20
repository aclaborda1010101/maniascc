import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

type CallState = "idle" | "connecting" | "connected" | "error";

interface TranscriptItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  done: boolean;
}

/**
 * Full-screen realtime voice call with OpenAI Realtime API via WebRTC.
 * Uses an ephemeral token issued by the realtime-token edge function.
 */
export function AvaRealtimeOverlay({ open, onClose }: Props) {
  const { toast } = useToast();
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callStartRef = useRef<number>(0);
  const durationTimerRef = useRef<number | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-start when overlay opens
  useEffect(() => {
    if (open && state === "idle") {
      startCall();
    }
    if (!open) {
      stopCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  // Call duration timer
  useEffect(() => {
    if (state === "connected") {
      callStartRef.current = Date.now();
      durationTimerRef.current = window.setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 1000);
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [state]);

  const startCall = async () => {
    setState("connecting");
    setTranscript([]);
    setCallDuration(0);

    try {
      // 1. Get ephemeral token from edge function
      const { data, error } = await supabase.functions.invoke("realtime-token", { body: {} });
      if (error || !data?.client_secret?.value) {
        throw new Error(error?.message || data?.error || "No se pudo obtener token");
      }
      const ephemeralKey: string = data.client_secret.value;
      const model: string = data.model;

      // 2. Get mic stream
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = micStream;

      // 3. Set up RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio
      pc.ontrack = (e) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      // Add local mic
      micStream.getAudioTracks().forEach((track) => pc.addTrack(track, micStream));

      // Data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("open", () => {
        // Send initial session config tweaks if needed
      });
      dc.addEventListener("message", (e) => {
        try {
          const evt = JSON.parse(e.data);
          handleRealtimeEvent(evt);
        } catch {/* ignore */}
      });

      // 4. SDP offer/answer with OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      if (!sdpResp.ok) {
        const t = await sdpResp.text();
        throw new Error(`OpenAI Realtime SDP ${sdpResp.status}: ${t.slice(0, 200)}`);
      }
      const answerSdp = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setState("connected");
    } catch (e) {
      console.error("Realtime call error:", e);
      toast({
        title: "Error iniciando llamada",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      });
      setState("error");
      stopCall();
    }
  };

  const handleRealtimeEvent = (evt: any) => {
    const t = evt.type as string;

    if (t === "input_audio_buffer.speech_started") setUserSpeaking(true);
    else if (t === "input_audio_buffer.speech_stopped") setUserSpeaking(false);
    else if (t === "response.audio.delta") setAiSpeaking(true);
    else if (t === "response.audio.done" || t === "response.done") setAiSpeaking(false);

    // User transcription (as it comes from whisper-1)
    if (t === "conversation.item.input_audio_transcription.completed") {
      const itemId = evt.item_id as string;
      const text = evt.transcript as string;
      if (text) {
        setTranscript((prev) => [...prev, { id: itemId + ":u", role: "user", text, done: true }]);
      }
    }

    // Assistant text streaming
    if (t === "response.audio_transcript.delta") {
      const respId = evt.response_id as string;
      const delta = evt.delta as string;
      setTranscript((prev) => {
        const existing = prev.find((p) => p.id === respId + ":a");
        if (existing) {
          return prev.map((p) => (p.id === respId + ":a" ? { ...p, text: p.text + delta } : p));
        }
        return [...prev, { id: respId + ":a", role: "assistant", text: delta, done: false }];
      });
    }
    if (t === "response.audio_transcript.done") {
      const respId = evt.response_id as string;
      setTranscript((prev) => prev.map((p) => (p.id === respId + ":a" ? { ...p, done: true } : p)));
    }
  };

  const stopCall = () => {
    try { dcRef.current?.close(); } catch {/* */}
    try { pcRef.current?.close(); } catch {/* */}
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;
    setAiSpeaking(false);
    setUserSpeaking(false);
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    setState("idle");
  };

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const handleEnd = () => {
    stopCall();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-between py-10 px-4 animate-in fade-in duration-200">
      {/* Top: AVA orb + status */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <div className="relative">
          <div
            className={cn(
              "w-32 h-32 rounded-full bg-gradient-to-br from-accent to-accent/40 flex items-center justify-center transition-all",
              aiSpeaking && "scale-110 shadow-[0_0_60px_-10px_hsl(var(--accent))]",
              userSpeaking && !aiSpeaking && "ring-4 ring-accent/40",
            )}
          >
            <Sparkles className={cn("h-14 w-14 text-accent-foreground", aiSpeaking && "animate-pulse")} />
          </div>
          {/* Pulse rings while AI speaks */}
          {aiSpeaking && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" />
              <div className="absolute -inset-2 rounded-full border border-accent/20 animate-ping" style={{ animationDelay: "150ms" }} />
            </>
          )}
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold">AVA</div>
          <div className="text-xs text-muted-foreground mt-1">
            {state === "connecting" && (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Conectando…
              </span>
            )}
            {state === "connected" && (
              <span>{aiSpeaking ? "Hablando…" : userSpeaking ? "Escuchando…" : "En llamada"} · {formatDuration(callDuration)}</span>
            )}
            {state === "error" && <span className="text-destructive">Error de conexión</span>}
            {state === "idle" && <span>Listo</span>}
          </div>
        </div>
      </div>

      {/* Middle: live transcript */}
      <div
        ref={transcriptRef}
        className="flex-1 w-full max-w-xl my-6 overflow-y-auto px-4 space-y-3"
      >
        {transcript.length === 0 && state === "connected" && (
          <p className="text-center text-xs text-muted-foreground/70 mt-8">
            Habla cuando quieras. AVA te responderá en tiempo real.
          </p>
        )}
        {transcript.map((item) => (
          <div
            key={item.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
              item.role === "user"
                ? "ml-auto bg-accent text-accent-foreground"
                : "mr-auto bg-card border border-border",
            )}
          >
            {item.text}
            {!item.done && <span className="inline-block w-1 h-3 ml-1 bg-current animate-pulse" />}
          </div>
        ))}
      </div>

      {/* Bottom: controls */}
      <div className="flex items-center gap-6 mb-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("h-14 w-14 rounded-full", muted && "bg-destructive/10 border-destructive text-destructive")}
          onClick={toggleMute}
          disabled={state !== "connected"}
          title={muted ? "Activar micrófono" : "Silenciar micrófono"}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        <Button
          type="button"
          size="icon"
          className="h-16 w-16 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={handleEnd}
          title="Colgar"
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>

      {/* Hidden audio sink for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
    </div>
  );
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

/**
 * Compact "Call AVA" button that opens the overlay.
 */
export function AvaCallButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  const sizeBtn = compact ? "h-8 w-8" : "h-9 w-9";
  const sizeIcon = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(sizeBtn, "shrink-0 text-accent hover:bg-accent/10")}
      onClick={onClick}
      title="Llamar a AVA (voz en tiempo real)"
    >
      <Phone className={sizeIcon} />
    </Button>
  );
}
