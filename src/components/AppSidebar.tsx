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
          <SidebarMenuButton
            asChild
            tooltip={item.title}
            className="!bg-transparent hover:!bg-transparent active:!bg-transparent data-[active=true]:!bg-transparent focus-visible:!ring-0"
          >
            <NavLink to={item.url} end={item.url === "/dashboard"} className="" activeClassName="">
              <span
                className={`relative flex items-center gap-3 rounded-xl px-2.5 py-2 w-full transition-all
                  ${active
                    ? "text-white"
                    : "text-white/70 hover:text-white hover:bg-white/[0.04]"}`}
                style={active ? {
                  background: "linear-gradient(135deg, hsl(var(--acc-1) / 0.18), hsl(var(--acc-2) / 0.14))",
                  boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.14)",
                } : undefined}
              >
                {active && (
                  <span
                    className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-md"
                    style={{ background: "linear-gradient(180deg, hsl(var(--acc-1)), hsl(var(--acc-2)))" }}
                  />
                )}
                <item.icon
                  className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[hsl(var(--acc-1))]" : "text-white/55"}`}
                />
                {!collapsed && <span className="truncate text-[13px] font-medium">{item.title}</span>}
                {!collapsed && item.highlight && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full"
                    style={{ background: "hsl(var(--acc-4))", boxShadow: "0 0 8px hsl(var(--acc-4))" }}
                  />
                )}
              </span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0 bg-transparent"
      style={{ "--sidebar-width": "240px" } as any}
    >
      {/* Glass container around the entire sidebar */}
      <div className="m-3 mr-0 rounded-[20px] glass flex flex-col h-[calc(100vh-1.5rem)] overflow-hidden">
        <SidebarHeader className="p-3.5 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-[10px] grid place-items-center text-[14px] font-bold text-black shrink-0 gradient-conic"
              style={{ boxShadow: "0 0 24px -6px hsl(var(--acc-2)), inset 0 1px 0 hsl(0 0% 100% / 0.6)" }}
            >
              A
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-tight text-white">AVA</p>
                <p className="text-[10.5px] text-white/55 -mt-0.5">Manias · CC</p>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 overflow-y-auto">
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] text-white/40 font-semibold px-2.5 mt-1">
                General
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent><SidebarMenu>{renderItems(mainItems)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] text-white/40 font-semibold px-2.5">
                Directorio
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent><SidebarMenu>{renderItems(directoryItems)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] text-white/40 font-semibold px-2.5">
                <Brain className="inline h-3 w-3 mr-1 -mt-0.5" /> Inteligencia
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent><SidebarMenu>{renderItems(aiToolsItems)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] text-white/40 font-semibold px-2.5">
                Sistema
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent><SidebarMenu>{renderItems(adminItems)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-white/[0.08]">
          <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
            <div
              className="h-7 w-7 rounded-[8px] grid place-items-center text-[10.5px] font-semibold text-black shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(var(--acc-3)), hsl(var(--acc-2)))" }}
            >
              {initials}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate text-white">{user?.email?.split("@")[0]}</p>
                  <p className="text-[10.5px] text-white/55 truncate">Admin · Manias</p>
                </div>
                <Button
                  size="icon" variant="ghost" onClick={signOut}
                  className="h-6 w-6 shrink-0 text-white/55 hover:text-white hover:bg-white/[0.06] rounded-md"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
