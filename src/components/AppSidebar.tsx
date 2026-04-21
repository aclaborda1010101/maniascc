import {
  LayoutDashboard, Users, Sparkles, LogOut, FileText,
  FolderKanban, UserCircle, MapPin, Brain, Hammer,
  Compass, FileSearch, Layers, MessageSquare, Settings, Network, FlaskConical, DollarSign, BookOpen,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "AVA", url: "/asistente", icon: Sparkles, highlight: true },
  { title: "Oportunidades", url: "/oportunidades", icon: FolderKanban },
  { title: "Generador", url: "/generador", icon: Hammer },
];

const directoryItems = [
  { title: "Activos", url: "/activos", icon: MapPin },
  { title: "Operadores", url: "/operadores", icon: Users },
  { title: "Contactos", url: "/contactos", icon: UserCircle },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Conocimiento", url: "/conocimiento", icon: BookOpen },
];

const aiToolsItems = [
  { title: "Localización", url: "/localizacion", icon: Compass },
  { title: "Validación Dossier", url: "/validacion-dossier", icon: FileSearch },
  { title: "Optimización Mix", url: "/tenant-mix", icon: Layers },
  { title: "Negociación IA", url: "/negociacion-ia", icon: MessageSquare },
];

const adminItems = [
  { title: "Consumo", url: "/consumo", icon: DollarSign },
  { title: "Patrones", url: "/patrones", icon: Network },
  { title: "Playground", url: "/playground", icon: FlaskConical },
  { title: "Ajustes", url: "/ajustes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const initials = (user?.email || "?").slice(0, 2).toUpperCase();

  const renderItems = (items: typeof mainItems) =>
    items.map((item: any) => {
      const active = isActive(item.url);
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild tooltip={item.title}>
            <NavLink
              to={item.url}
              end={item.url === "/dashboard"}
              className="hover:bg-sidebar-accent/60"
              activeClassName=""
            >
              <span className={`relative flex items-center gap-3 rounded-xl px-2 py-1.5 w-full transition-all ${
                active
                  ? "bg-accent/12 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full ava-gradient" />}
                <item.icon className={`h-4 w-4 shrink-0 ${item.highlight ? "text-accent" : ""}`} />
                {!collapsed && <span className="truncate text-sm">{item.title}</span>}
                {!collapsed && item.highlight && (
                  <span className="ml-auto text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-accent/15 text-accent font-semibold">
                    IA
                  </span>
                )}
              </span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 shrink-0">
            <div className="absolute inset-0 rounded-2xl ava-gradient glow-ring-soft" />
            <div className="absolute inset-[2px] rounded-[14px] bg-background grid place-items-center">
              <span className="text-sm font-bold ava-text-gradient">A</span>
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-base font-bold tracking-tight ava-text-gradient">AVA</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground -mt-0.5">Retail Intelligence</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3">Operativa</SidebarGroupLabel>}
          <SidebarGroupContent><SidebarMenu>{renderItems(mainItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-1">
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3">Directorio</SidebarGroupLabel>}
          <SidebarGroupContent><SidebarMenu>{renderItems(directoryItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-1">
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3">
              <Brain className="inline h-3 w-3 mr-1" /> Motor predictivo
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent><SidebarMenu>{renderItems(aiToolsItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-1">
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3">Admin</SidebarGroupLabel>}
          <SidebarGroupContent><SidebarMenu>{renderItems(adminItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/40">
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="h-8 w-8 rounded-full ava-gradient grid place-items-center text-[11px] font-semibold text-white shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.email?.split("@")[0]}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={signOut} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
