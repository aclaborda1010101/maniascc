import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RecorderStatus = "idle" | "recording" | "processing" | "error";

interface UseVoiceRecorderOpts {
  onTranscript?: (text: string) => void;
  /** if true, returns text via callback but doesn't manage state (used by conversation mode) */
  silent?: boolean;
}

/**
 * Microphone recorder + transcription via ava-transcribe edge function.
 */
export function useVoiceRecorder(opts: UseVoiceRecorderOpts = {}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(250);
      startedAtRef.current = Date.now();
      setStatus("recording");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error accediendo al micrófono";
      setError(msg);
      setStatus("error");
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(async (): Promise<string | null> => {
    const rec = mediaRecorderRef.current;
    if (!rec) return null;

    return new Promise<string | null>((resolve) => {
      rec.onstop = async () => {
        const dur = Date.now() - startedAtRef.current;
        const mt = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mt });
        cleanup();

        if (dur < 400 || blob.size < 1024) {
          setStatus("idle");
          resolve(null);
          return;
        }

        if (!opts.silent) setStatus("processing");
        try {
          const base64 = await blobToBase64(blob);
          const { data, error: invErr } = await supabase.functions.invoke("ava-transcribe", {
            body: { audio_base64: base64, mime_type: mt.split(";")[0] },
          });
          if (invErr || data?.error) {
            setError(invErr?.message || data?.error || "Error transcribiendo");
            setStatus("error");
            resolve(null);
            return;
          }
          const text = (data?.text || "").trim();
          setStatus("idle");
          if (text && opts.onTranscript) opts.onTranscript(text);
          resolve(text || null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error");
          setStatus("error");
          resolve(null);
        }
      };
      rec.stop();
    });
  }, [cleanup, opts]);

  const cancel = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null as any;
      rec.stop();
    }
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  return { status, error, start, stop, cancel };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onloadend = () => {
      const result = r.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.readAsDataURL(blob);
  });
}
