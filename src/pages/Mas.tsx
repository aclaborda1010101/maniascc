import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ChevronRight, MapPin, Users, UserCircle, FileText, Network, BookOpen, DollarSign, Settings, Compass, FileSearch, Layers, MessageSquare, Hammer, FlaskConical, LogOut } from "lucide-react";

const sections: { title: string; items: { to: string; icon: any; label: string; hint?: string }[] }[] = [
  {
    title: "Cartera",
    items: [
      { to: "/activos", icon: MapPin, label: "Activos" },
      { to: "/operadores", icon: Users, label: "Operadores" },
      { to: "/contactos", icon: UserCircle, label: "Contactos" },
      { to: "/documentos", icon: FileText, label: "Documentos" },
    ],
  },
  {
    title: "Inteligencia",
    items: [
      { to: "/patrones", icon: Network, label: "Patrones" },
      { to: "/conocimiento", icon: BookOpen, label: "Conocimiento" },
      { to: "/localizacion", icon: Compass, label: "Localización" },
      { to: "/validacion-dossier", icon: FileSearch, label: "Validación dossier" },
      { to: "/tenant-mix", icon: Layers, label: "Optimización mix" },
      { to: "/negociacion-ia", icon: MessageSquare, label: "Negociación IA" },
      { to: "/generador", icon: Hammer, label: "Generador documentos" },
    ],
  },
  {
    title: "Cuenta",
    items: [
      { to: "/consumo", icon: DollarSign, label: "Consumo y costes" },
      { to: "/playground", icon: FlaskConical, label: "Playground" },
      { to: "/ajustes", icon: Settings, label: "Ajustes" },
    ],
  },
];

export default function Mas() {
  const { user, signOut } = useAuth();
  const initials = (user?.email || "?").slice(0, 2).toUpperCase();
  const name = user?.email?.split("@")[0] || "Usuario";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header user */}
      <div className="card-premium p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl ava-gradient grid place-items-center text-white font-bold text-lg shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold tracking-tight truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full ava-gradient text-white tracking-wider">
          PRO
        </span>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold px-2">
            {section.title}
          </p>
          <div className="card-premium overflow-hidden divide-y divide-border/50">
            {section.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-accent/10 grid place-items-center shrink-0">
                  <item.icon className="h-4 w-4 text-accent" />
                </div>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={() => signOut()}
        className="w-full card-premium p-4 flex items-center justify-center gap-2 text-sm text-destructive hover:bg-destructive/5 transition-colors font-medium"
      >
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>

      <p className="text-center text-[10px] text-muted-foreground/60 pb-4">
        AVA · Retail Intelligence · v3.0
      </p>
    </div>
  );
}
