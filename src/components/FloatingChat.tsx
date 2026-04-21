import { useState, lazy, Suspense } from "react";
import { Sparkles, X } from "lucide-react";

const FloatingChatPanel = lazy(() => import("./FloatingChatPanel"));

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    setHasOpened(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {hasOpened && (
        <Suspense fallback={null}>
          <FloatingChatPanel open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
      <button
        onClick={() => open ? setOpen(false) : handleOpen()}
        className="h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center hover:bg-accent/90 transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </div>
  );
}
