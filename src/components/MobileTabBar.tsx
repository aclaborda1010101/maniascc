import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, FolderKanban, MoreHorizontal, MapPin, Users, UserCircle, FileText,
  BookOpen, Compass, FileSearch, Layers, MessageSquare, DollarSign, Network,
  FlaskConical, Settings, Hammer, LogOut, Sun, Moon, X, Sparkles,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const tabs = [
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/oportunidades", label: "Oport.", icon: FolderKanban },
  { to: "/asistente", label: "AVA", icon: Sparkles, ava: true },
  { to: "/activos", label: "Activos", icon: MapPin },
];

const menuGroups = [
  {
    title: "Directorio",
    items: [
      { to: "/activos", label: "Activos", icon: MapPin },
      { to: "/operadores", label: "Operadores", icon: Users },
      { to: "/contactos", label: "Contactos", icon: UserCircle },
      { to: "/documentos", label: "Documentos", icon: FileText },
      { to: "/conocimiento", label: "Conocimiento", icon: BookOpen },
    ],
  },
  {
    title: "Motor Predictivo",
    items: [
      { to: "/localizacion", label: "Localización", icon: Compass },
      { to: "/validacion-dossier", label: "Validación Dossier", icon: FileSearch },
      { to: "/tenant-mix", label: "Optimización Ocupación", icon: Layers },
      { to: "/negociacion-ia", label: "Negociación IA", icon: MessageSquare },
      { to: "/generador", label: "Generador Documentos", icon: Hammer },
    ],
  },
  {
    title: "Admin",
    items: [
      { to: "/consumo", label: "Consumo y Costes", icon: DollarSign },
      { to: "/patrones", label: "Patrones", icon: Network },
      { to: "/playground", label: "Playground", icon: FlaskConical },
      { to: "/ajustes", label: "Ajustes", icon: Settings },
    ],
  },
];

export function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  const initials = user?.email?.substring(0, 2).toUpperCase() || "AT";

  const go = (to: string) => {
    navigate(to);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Bottom floating tab bar */}
      <nav className="tab-bar-mobile flex items-center justify-around px-2">
        {tabs.map((t) => {
          const active = isActive(t.to);
          if (t.ava) {
            return (
              <button
                key={t.to}
                onClick={() => go(t.to)}
                className="flex flex-col items-center gap-1 px-2"
                aria-label={t.label}
              >
                <div className="ava-orb h-11 w-11">
                  <div className="ava-orb-inner">
                    <Sparkles className="h-4 w-4 text-foreground/85" strokeWidth={2.2} />
                  </div>
                </div>
                <span className={`text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
              </button>
            );
          }
          const Icon = t.icon;
          return (
            <button
              key={t.to}
              onClick={() => go(t.to)}
              className="flex flex-col items-center gap-1 px-3 py-1.5"
              aria-label={t.label}
            >
              <Icon className={`h-5 w-5 ${active ? "text-[hsl(var(--acc-1))]" : "text-muted-foreground"}`} strokeWidth={active ? 2.4 : 2} />
              <span className={`text-[10px] ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{t.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-1 px-3 py-1.5"
          aria-label="Más"
        >
          <MoreHorizontal className={`h-5 w-5 ${moreOpen ? "text-[hsl(var(--acc-1))]" : "text-muted-foreground"}`} />
          <span className={`text-[10px] ${moreOpen ? "text-foreground font-medium" : "text-muted-foreground"}`}>Más</span>
        </button>
      </nav>

      {/* Full-screen "Más" sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] w-full max-w-full p-0 border-0 bg-background"
        >
          <div className="ambient" aria-hidden="true">
            <div className="ambient-blob b3" />
            <div className="ambient-blob b4" />
          </div>

          <div className="relative z-10 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 ring-1 ring-border/60">
                  <AvatarFallback className="bg-[linear-gradient(135deg,hsl(var(--acc-2)),hsl(var(--acc-3)))] text-[#0a0a0b] text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Equipo</p>
                  <p className="font-display text-2xl font-semibold tracking-tight truncate">Más</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setMoreOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Scrollable groups */}
            <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-6">
              {menuGroups.map((g) => (
                <div key={g.title}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-2">{g.title}</p>
                  <div className="list-glass">
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.to);
                      return (
                        <button
                          key={item.to}
                          onClick={() => go(item.to)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${active ? "bg-[hsl(var(--acc-1)/0.10)]" : "hover:bg-secondary/40"}`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[hsl(var(--acc-1))]" : "text-muted-foreground"}`} />
                          <span className={`flex-1 text-sm ${active ? "text-foreground font-medium" : "text-foreground/90"}`}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Cuenta */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-2">Cuenta</p>
                <div className="list-glass">
                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/40"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
                    <span className="flex-1 text-sm">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
                  </button>
                  <button
                    onClick={() => { signOut(); setMoreOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/40"
                  >
                    <LogOut className="h-4 w-4 text-destructive" />
                    <span className="flex-1 text-sm text-destructive">Cerrar sesión</span>
                  </button>
                </div>
                {user && (
                  <p className="text-[11px] text-muted-foreground text-center mt-3">{user.email}</p>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
