import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, FolderKanban, Sparkles, Heart, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const onAva = location.pathname.startsWith("/asistente");

  const isActive = (to: string, end = false) =>
    end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none"
      aria-label="Navegación principal"
    >
      <div
        className="pointer-events-auto flex items-stretch px-2.5 pt-2"
        style={{
          paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
          background: "hsl(224 30% 4% / 0.78)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          borderTop: "1px solid hsl(0 0% 100% / 0.08)",
        }}
      >
        <BottomItem to="/dashboard" label="Inicio"  icon={Home}          active={isActive("/dashboard", true)} />
        <BottomItem to="/oportunidades" label="Oport." icon={FolderKanban} active={isActive("/oportunidades")} />

        {/* FAB AVA central */}
        <button
          onClick={() => navigate("/asistente")}
          aria-label="Abrir AVA"
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-2xl text-white transition-transform active:scale-95",
            onAva && "animate-pulse"
          )}
          style={{
            background: "linear-gradient(135deg, hsl(var(--acc-1)), hsl(var(--acc-2)))",
            boxShadow: "0 6px 16px -4px hsl(var(--acc-2) / 0.7)",
            margin: "-4px 4px 0",
          }}
        >
          <Sparkles className="h-5 w-5 drop-shadow" />
          <span className="text-[10px] font-semibold leading-none">AVA</span>
        </button>

        <BottomItem to="/matching" label="Match" icon={Heart} active={isActive("/matching")} />
        <BottomItem to="/mas" label="Más" icon={MoreHorizontal} active={isActive("/mas")} />
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
        "flex-1 flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors",
        active ? "text-[hsl(var(--acc-1))]" : "text-white/55 hover:text-white/80"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </NavLink>
  );
}
