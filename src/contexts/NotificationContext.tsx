import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  type: "match_update" | "match_created" | "info";
  link?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load from DB on mount / user change
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notificaciones")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (data) {
        setNotifications(
          data.map((r: any) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            timestamp: new Date(r.created_at),
            read: r.read,
            type: r.type as AppNotification["type"],
            link: r.link,
          }))
        );
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const addNotification = useCallback(
    async (n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      if (!user) return;

      const { data, error } = await supabase
        .from("notificaciones")
        .insert({
          user_id: user.id,
          title: n.title,
          description: n.description,
          type: n.type,
          link: n.link || null,
        })
        .select()
        .single();

      if (data && !error) {
        const newNotif: AppNotification = {
          id: data.id,
          title: data.title,
          description: data.description,
          timestamp: new Date(data.created_at),
          read: false,
          type: data.type as AppNotification["type"],
          link: data.link,
        };
        setNotifications((prev) => [newNotif, ...prev].slice(0, 100));
      }
    },
    [user]
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notificaciones")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from("notificaciones").update({ read: true }).eq("id", id);
  }, []);

  const clearAll = useCallback(async () => {
    if (!user) return;
    setNotifications([]);
    await supabase.from("notificaciones").delete().eq("user_id", user.id);
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, markRead, clearAll, loading }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
