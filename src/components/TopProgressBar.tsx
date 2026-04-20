import { useEffect, useState } from "react";

/**
 * Barra de progreso superior tipo NProgress.
 * Visible mientras Suspense está cargando un chunk.
 * Mantiene el contenido anterior visible (no oculta layout).
 */
export function TopProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let raf: number;
    let start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      // Curva asintótica: avanza rápido al inicio, se frena cerca del 90%
      const next = Math.min(90, (elapsed / 8) * (1 - elapsed / 2000));
      setProgress(Math.max(next, 10));
      if (elapsed < 1500) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      setProgress(100);
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] bg-transparent pointer-events-none"
      role="progressbar"
      aria-label="Cargando"
    >
      <div
        className="h-full bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.6)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
