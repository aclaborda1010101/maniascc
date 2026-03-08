import { useState, useMemo } from "react";
import { useNotifications, AppNotification } from "@/contexts/NotificationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, CheckCheck, Trash2, Filter, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const PAGE_SIZE = 20;

const typeLabels: Record<AppNotification["type"], string> = {
  match_update: "Actualización de match",
  match_created: "Nuevo match",
  info: "Información",
};

const typeIcons: Record<AppNotification["type"], string> = {
  match_update: "🔄",
  match_created: "✨",
  info: "ℹ️",
};

export default function Notificaciones() {
  const { notifications, markAllRead, markRead, clearAll, loading } = useNotifications();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (dateFrom && n.timestamp < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (n.timestamp > end) return false;
      }
      return true;
    });
  }, [notifications, typeFilter, dateFrom, dateTo]);

  const unreadCount = filtered.filter((n) => !n.read).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safeePage - 1) * PAGE_SIZE, safeePage * PAGE_SIZE);

  const clearFilters = () => {
    setTypeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  const hasFilters = typeFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} notificación{filtered.length !== 1 ? "es" : ""}
            {unreadCount > 0 && ` · ${unreadCount} sin leer`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4 mr-1" /> Marcar leídas
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={notifications.length === 0}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpiar todo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="match_update">Actualización de match</SelectItem>
                  <SelectItem value="match_created">Nuevo match</SelectItem>
                  <SelectItem value="info">Información</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd MMM yyyy", { locale: es }) : "Fecha inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd MMM yyyy", { locale: es }) : "Fecha fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-1" /> Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-3 opacity-40" />
            <p className="font-medium">Sin notificaciones</p>
            <p className="text-sm">No hay notificaciones que coincidan con los filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <Card
              key={n.id}
              className={cn("transition-colors cursor-pointer hover:bg-muted/40", !n.read && "border-l-4 border-l-accent bg-accent/5")}
              onClick={() => !n.read && markRead(n.id)}
            >
              <CardContent className="flex items-start gap-3 py-3 px-4">
                <span className="text-lg mt-0.5">{typeIcons[n.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{n.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {typeLabels[n.type]}
                    </Badge>
                    {!n.read && <Badge className="text-[10px] px-1.5 py-0">Nueva</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{n.description}</p>
                  <span className="text-xs text-muted-foreground">
                    {format(n.timestamp, "dd MMM yyyy, HH:mm", { locale: es })}
                  </span>
                </div>
                {n.link && (
                  <Link
                    to={n.link}
                    className="text-xs text-primary hover:underline whitespace-nowrap mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Ver detalle →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
