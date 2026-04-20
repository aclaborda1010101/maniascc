import {
  LayoutDashboard, Users, Sparkles, LogOut, FileText,
  FolderKanban, UserCircle, MapPin, Brain, Hammer,
  Compass, FileSearch, Layers, MessageSquare, Moon, Sun, Settings, Network, FlaskConical, DollarSign, BookOpen,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "AVA", url: "/asistente", icon: Sparkles },
  { title: "Oportunidades", url: "/oportunidades", icon: FolderKanban },
  { title: "Generador de Documentos", url: "/generador", icon: Hammer },
];

const directoryItems = [
  { title: "Activos", url: "/activos", icon: MapPin },
  { title: "Operadores", url: "/operadores", icon: Users },
  { title: "Contactos (Hub)", url: "/contactos", icon: UserCircle },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Conocimiento", url: "/conocimiento", icon: BookOpen },
];

const aiToolsItems = [
  { title: "Localización", url: "/localizacion", icon: Compass },
  { title: "Validación Dossier", url: "/validacion-dossier", icon: FileSearch },
  { title: "Optimización de Ocupación", url: "/tenant-mix", icon: Layers },
  { title: "Negociación IA", url: "/negociacion-ia", icon: MessageSquare },
];

const adminItems = [
  { title: "Consumo y Costes", url: "/consumo", icon: DollarSign },
  { title: "Patrones", url: "/patrones", icon: Network },
  { title: "Playground", url: "/playground", icon: FlaskConical },
  { title: "Ajustes", url: "/ajustes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const renderItems = (items: typeof mainItems) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <NavLink
            to={item.url}
            end={item.url === "/dashboard"}
            className="hover:bg-sidebar-accent/50"
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
          >
            <item.icon className="mr-2 h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed ? (
              <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <Sparkles className="h-5 w-5 text-sidebar-primary" />
                AVA
              </span>
            ) : (
              <Sparkles className="h-5 w-5 text-sidebar-primary" />
            )}
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* Main */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Directorio */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3">
              Directorio
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(directoryItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Motor Predictivo */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3">
              <Brain className="inline h-3 w-3 mr-1" /> Motor Predictivo
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(aiToolsItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Admin */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3">
              Admin
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(adminItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
        </Button>
        {!collapsed && user && (
          <p className="truncate px-2 text-xs text-sidebar-foreground/60">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
