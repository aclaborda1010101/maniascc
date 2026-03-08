import {
  LayoutDashboard, MapPin, Users, Sparkles, LogOut, FileText, Search,
  Compass, FileSearch, Layers, MessageSquare, FolderKanban, Contact,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const sections = [
  {
    label: "General",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Búsqueda", url: "/busqueda", icon: Search },
    ],
  },
  {
    label: "Proyectos",
    items: [
      { title: "Proyectos", url: "/proyectos", icon: FolderKanban },
    ],
  },
  {
    label: "Directorio",
    items: [
      { title: "Locales", url: "/locales", icon: MapPin },
      { title: "Operadores", url: "/operadores", icon: Users },
      { title: "Contactos", url: "/contactos", icon: Contact },
      { title: "Documentos", url: "/documentos", icon: FileText },
    ],
  },
  {
    label: "Inteligencia IA",
    items: [
      { title: "Localización", url: "/localizacion-analisis", icon: Compass },
      { title: "Validar Dossier", url: "/validacion-dossier", icon: FileSearch },
      { title: "Tenant Mix", url: "/tenant-mix", icon: Layers },
      { title: "Negociación", url: "/negociacion-briefing", icon: MessageSquare },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed ? (
              <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <Sparkles className="h-5 w-5 text-sidebar-primary" />
                ATLAS
              </span>
            ) : (
              <Sparkles className="h-5 w-5 text-sidebar-primary" />
            )}
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* Sections */}
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
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
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && user && (
          <p className="mb-2 truncate px-2 text-xs text-sidebar-foreground/60">
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
