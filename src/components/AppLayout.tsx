import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useMatchNotifications } from "@/hooks/useMatchNotifications";
import { NotificationCenter } from "@/components/NotificationCenter";
import { FloatingChat } from "@/components/FloatingChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useIsMobile();
  useMatchNotifications();

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/busqueda?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
      setSearchOpen(false);
    }
  };

  const initials = user?.email?.substring(0, 2).toUpperCase() || "AT";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-3 md:px-4 gap-2 md:gap-4 shrink-0">
            <SidebarTrigger className="h-9 w-9 flex items-center justify-center" />
            <h2 className="hidden md:block text-sm font-semibold tracking-tight text-foreground">AVA</h2>

            {/* Desktop search */}
            {!isMobile && (
              <div className="flex-1 mx-4 max-w-md relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10 h-9"
                  placeholder="Buscar locales, operadores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                />
              </div>
            )}

            {/* Mobile search toggle */}
            {isMobile && !searchOpen && (
              <Button variant="ghost" size="icon" className="h-9 w-9 ml-auto" onClick={() => setSearchOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
            )}

            {/* Mobile expanded search */}
            {isMobile && searchOpen && (
              <div className="flex-1 flex items-center gap-1 ml-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                    autoFocus
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className={`flex items-center gap-2 ${isMobile && searchOpen ? "hidden" : "ml-auto"}`}>
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs">{initials}</AvatarFallback>
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
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
          {location.pathname !== "/asistente" && <FloatingChat />}
        </div>
      </div>
    </SidebarProvider>
  );
}
