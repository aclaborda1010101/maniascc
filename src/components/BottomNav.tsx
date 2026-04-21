import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, FolderKanban, Sparkles, Heart, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Inicio", icon: Home, end: true },
  { to: "/oportunidades", label: "Oport.", icon: FolderKanban, end: false },
  // FAB centro inserto manualmente abajo
  { to: "/matching", label: "Match", icon: Heart, end: false },
  { to: "/mas", label: "Más", icon: MoreHorizontal, end: false },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const onAva = location.pathname.startsWith("/asistente");

  const isActive = (to: string, end: boolean) =>
    end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none"
      aria-label="Navegación principal"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="pointer-events-auto relative px-3 pb-3 pt-2">
        <div className="card-premium card-elevated mx-auto flex items-end justify-around gap-1 px-2 py-2 shadow-xl">
          {/* Inicio */}
          <BottomItem to={items[0].to} label={items[0].label} icon={items[0].icon} active={isActive(items[0].to, true)} />
          {/* Oportunidades */}
          <BottomItem to={items[1].to} label={items[1].label} icon={items[1].icon} active={isActive(items[1].to, false)} />

          {/* FAB AVA */}
          <button
            onClick={() => navigate("/asistente")}
            aria-label="Abrir AVA"
            className={cn(
              "relative -mt-7 h-16 w-16 rounded-full ava-gradient grid place-items-center text-white shrink-0 transition-transform active:scale-95 glow-ring",
              onAva && "ring-2 ring-white/50 animate-pulse"
            )}
          >
            <Sparkles className="h-7 w-7 drop-shadow" />
          </button>

          {/* Match */}
          <BottomItem to={items[2].to} label={items[2].label} icon={items[2].icon} active={isActive("/matching", false)} />
          {/* Más */}
          <BottomItem to={items[3].to} label={items[3].label} icon={items[3].icon} active={isActive(items[3].to, false)} />
        </div>
      </div>
    </nav>
  );
}

function BottomItem({
  to, label, icon: Icon, active,
}: { to: string; label: string; icon: any; active: boolean }) {
  return (
    <NavLink
      to={to}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-colors",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "text-accent")} />
      <span className={cn("text-[10px] font-medium leading-none", active && "ava-text-gradient")}>
        {label}
      </span>
    </NavLink>
  );
}
