import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Users, Plus, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface LinkedContact {
  id: string;
  link_id: string;
  nombre: string;
  apellidos?: string | null;
  empresa?: string | null;
  tipo: string;
}

interface Props {
  contactId: string;
  ownerId: string;
}

export function ContactosVinculadosPanel({ contactId, ownerId }: Props) {
  const [linked, setLinked] = useState<LinkedContact[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_links")
      .select("id, contact_a, contact_b, tipo")
      .or(`contact_a.eq.${contactId},contact_b.eq.${contactId}`);

    if (!data || data.length === 0) {
      setLinked([]);
      setLoading(false);
      return;
    }

    const otherIds = data.map((l) =>
      l.contact_a === contactId ? l.contact_b : l.contact_a
    );
    const { data: contacts } = await supabase
      .from("contactos")
      .select("id, nombre, apellidos, empresa")
      .in("id", otherIds);

    const merged = data
      .map((l) => {
        const otherId = l.contact_a === contactId ? l.contact_b : l.contact_a;
        const c = contacts?.find((x) => x.id === otherId);
        if (!c) return null;
        return {
          id: c.id,
          link_id: l.id,
          nombre: c.nombre,
          apellidos: c.apellidos,
          empresa: c.empresa,
          tipo: l.tipo,
        };
      })
      .filter(Boolean) as LinkedContact[];

    setLinked(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [contactId]);

  const doSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from("contactos")
      .select("id, nombre, apellidos, empresa, email")
      .neq("id", contactId)
      .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    setResults(data || []);
  };

  const link = async (otherId: string) => {
    const { error } = await supabase.from("contact_links").insert({
      owner_id: ownerId,
      contact_a: contactId,
      contact_b: otherId,
      tipo: "menciona",
    });
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Contacto vinculado" });
    setOpen(false);
    setSearch("");
    setResults([]);
    load();
  };

  const unlink = async (linkId: string) => {
    await supabase.from("contact_links").delete().eq("id", linkId);
    load();
  };

  return (
    <Card className="p-4 bg-card/40 backdrop-blur-md border-border/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Contactos vinculados</h3>
          {linked.length > 0 && (
            <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded">
              {linked.length}
            </span>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1">
              <Plus className="h-3.5 w-3.5" /> Vincular
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular contacto</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => doSearch(e.target.value)}
              autoFocus
            />
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => link(r.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/10 text-sm"
                >
                  <p className="font-medium">
                    {r.nombre} {r.apellidos || ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.empresa || r.email}
                  </p>
                </button>
              ))}
              {search.length >= 2 && results.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sin resultados.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      ) : linked.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Sin vínculos. Conecta este contacto con otros para que la red se
          enriquezca.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {linked.map((l) => (
            <li
              key={l.link_id}
              className="flex items-center justify-between rounded-md border border-border/40 bg-background/40 px-2.5 py-1.5 text-xs"
            >
              <button
                onClick={() => navigate(`/contactos/${l.id}`)}
                className="flex items-center gap-2 flex-1 text-left hover:text-accent"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="font-medium">
                  {l.nombre} {l.apellidos || ""}
                </span>
                {l.empresa && (
                  <span className="text-muted-foreground">· {l.empresa}</span>
                )}
                <span className="text-[9px] uppercase text-muted-foreground/70 ml-auto mr-2">
                  {l.tipo}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => unlink(l.link_id)}
                className="h-5 w-5"
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
