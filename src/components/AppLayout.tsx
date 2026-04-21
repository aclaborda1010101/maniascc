import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMatchNotifications } from "@/hooks/useMatchNotifications";
import { NotificationCenter } from "@/components/NotificationCenter";
import { FloatingChat } from "@/components/FloatingChat";
import { BottomNav } from "@/components/BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  useMatchNotifications();

  const initials = user?.email?.substring(0, 2).toUpperCase() || "AV";

  // En móvil ocultamos el FloatingChat (lo sustituye el FAB del BottomNav).
  // En /asistente también, ya hay UI propia.
  const showFloatingChat = !isMobile && location.pathname !== "/asistente";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden bg-background">
        {/* Ambient gradient blobs (decorativos, sólo desktop) */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden hidden md:block z-0">
          <div className="absolute -top-40 -left-20 h-[500px] w-[500px] rounded-full bg-[hsl(var(--ava-via)/0.08)] blur-[120px]" />
          <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-[hsl(var(--ava-from)/0.06)] blur-[140px]" />
          <div className="absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-[hsl(var(--ava-to)/0.05)] blur-[100px]" />
        </div>

        <div className="hidden md:block relative z-10">
          <AppSidebar />
        </div>

        <div className="relative z-10 flex-1 flex flex-col min-w-0">
          {/* Header desktop only */}
          <header className="hidden md:flex h-14 items-center border-b border-border/40 bg-background/60 backdrop-blur-xl px-4 gap-3 shrink-0 sticky top-0 z-20">
            <SidebarTrigger className="h-9 w-9 flex items-center justify-center" />
            <span className="font-display text-base font-semibold tracking-tight">
              <span className="ava-text-gradient">AVA</span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                    <Avatar className="h-8 w-8 ring-1 ring-border">
                      <AvatarFallback className="ava-gradient text-white text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user?.email}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>Cerrar sesión</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Mobile header — minimal: notificaciones + avatar */}
          <header className="md:hidden flex h-12 items-center px-4 gap-2 shrink-0 sticky top-0 z-20 bg-background/80 backdrop-blur-xl">
            <span className="font-display text-base font-bold ava-text-gradient">AVA</span>
            <div className="ml-auto flex items-center gap-1">
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="ava-gradient text-white text-[11px] font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user?.email}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>Cerrar sesión</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6 pb-28 md:pb-6 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </main>

          {showFloatingChat && <FloatingChat />}
          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
