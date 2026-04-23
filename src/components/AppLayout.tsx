import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMatchNotifications } from "@/hooks/useMatchNotifications";
import { NotificationCenter } from "@/components/NotificationCenter";
import { BottomNav } from "@/components/BottomNav";

import { Sparkles } from "lucide-react";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  
  useMatchNotifications();

  const initials = user?.email?.substring(0, 2).toUpperCase() || "AV";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden" style={{ background: "hsl(200 35% 5%)" }}>
        {/* Ambient iridescent blobs (fixed, behind everything) */}
        <div className="ambient" aria-hidden>
          <div className="ambient-blob-3" />
        </div>

        {/* Desktop sidebar (glass) */}
        <div className="hidden md:block relative z-10">
          <AppSidebar />
        </div>

        <div className="relative z-10 flex-1 flex flex-col min-w-0">
          {/* Desktop topbar — minimal, glass, with breadcrumb + AVA pill */}
          <header
            className="hidden md:flex h-14 items-center px-6 gap-4 shrink-0 sticky top-0 z-20"
            style={{
              background: "hsl(200 35% 6% / 0.55)",
              backdropFilter: "blur(40px) saturate(1.6)",
              WebkitBackdropFilter: "blur(40px) saturate(1.6)",
              borderBottom: "1px solid hsl(240 30% 100% / 0.07)",
            }}
          >
            <SidebarTrigger className="h-8 w-8 flex items-center justify-center text-white/55 hover:text-white" />
            <Crumb pathname={location.pathname} />
            <div className="ml-auto flex items-center gap-2">
              {/* "Preguntar a AVA" pill */}
              <button
                onClick={() => navigate("/asistente")}
                className="hidden lg:flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-full text-[12.5px] font-medium text-white transition-all hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--acc-1)), hsl(var(--acc-2)))",
                  boxShadow: "0 6px 20px -8px hsl(var(--acc-2) / 0.7)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Preguntar a AVA</span>
                <span
                  className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: "hsl(0 0% 100% / 0.18)" }}
                >
                  ⌘K
                </span>
              </button>

              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                    <Avatar className="h-8 w-8 ring-1 ring-white/10">
                      <AvatarFallback className="text-white text-xs font-semibold gradient-iridescent">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass border-white/10">
                  <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user?.email}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>Cerrar sesión</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Mobile header removed — identidad y notificaciones viven en BottomNav */}

          <main className="flex-1 overflow-auto px-4 md:px-8 pt-4 md:py-8 pb-28 md:pb-8 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </main>

          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}

/* ───────── Breadcrumb ───────── */
const PATH_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  asistente: "Asistente",
  oportunidades: "Oportunidades",
  activos: "Activos",
  operadores: "Operadores",
  contactos: "Contactos",
  documentos: "Documentos",
  conocimiento: "Conocimiento",
  matching: "Matching",
  patrones: "Patrones",
  ajustes: "Ajustes",
  consumo: "Consumo",
  generador: "Generador",
  localizacion: "Localización",
  "tenant-mix": "Optimización Mix",
  "negociacion-ia": "Negociación IA",
  "validacion-dossier": "Validación Dossier",
  playground: "Playground",
  mas: "Más",
};

function Crumb({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[0] ?? "";
  const label = PATH_LABELS[last] ?? last;
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-white/55">
      <span className="text-white/40">AVA</span>
      <span className="text-white/25">/</span>
      <span className="text-white/85 font-medium">{label}</span>
    </div>
  );
}
