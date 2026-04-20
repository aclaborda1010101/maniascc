/**
 * Lightweight wrapper around the browser SpeechSynthesis API.
 * Used by AVA conversation mode to read assistant replies aloud.
 */
export function speak(text: string, opts: { lang?: string; rate?: number; onEnd?: () => void } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts.onEnd?.();
    return;
  }
  // Strip markdown noise so TTS sounds natural
  const clean = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200); // limit to keep it snappy

  if (!clean) {
    opts.onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = opts.lang || "es-ES";
    utter.rate = opts.rate || 1.05;
    utter.pitch = 1;
    utter.onend = () => opts.onEnd?.();
    utter.onerror = () => opts.onEnd?.();
    window.speechSynthesis.speak(utter);
  } catch {
    opts.onEnd?.();
  }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
