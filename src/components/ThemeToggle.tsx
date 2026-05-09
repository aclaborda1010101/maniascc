import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme === "system" ? "system" : resolvedTheme) : "dark";
  const Icon = current === "light" ? Sun : current === "system" ? Monitor : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Cambiar tema"
          className={
            compact
              ? "h-8 w-8 flex items-center justify-center rounded-full text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
              : "h-9 px-3 flex items-center gap-2 rounded-full border border-border text-sm text-foreground/80 hover:bg-foreground/5"
          }
        >
          <Icon className="h-4 w-4" />
          {!compact && <span className="capitalize">{theme === "system" ? "Sistema" : current === "light" ? "Claro" : "Oscuro"}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass border-border">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="h-4 w-4 mr-2" /> Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="h-4 w-4 mr-2" /> Oscuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="h-4 w-4 mr-2" /> Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
