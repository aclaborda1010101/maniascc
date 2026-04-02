import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function CreateContactForm({ operadores, submitting, onSubmit }: {
  operadores: any[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-nombre">Nombre *</Label>
          <Input id="c-nombre" name="nombre" placeholder="Ana" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-apellidos">Apellidos</Label>
          <Input id="c-apellidos" name="apellidos" placeholder="García López" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-empresa">Empresa</Label>
          <Input id="c-empresa" name="empresa" placeholder="Grupo XYZ" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-cargo">Cargo</Label>
          <Input id="c-cargo" name="cargo" placeholder="Dir. Comercial" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" placeholder="ana@empresa.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-tel">Teléfono</Label>
          <Input id="c-tel" name="telefono" placeholder="+34 600 000 000" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-whatsapp">WhatsApp</Label>
          <Input id="c-whatsapp" name="whatsapp" placeholder="+34 600 000 000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-linkedin">LinkedIn</Label>
          <Input id="c-linkedin" name="linkedin_url" placeholder="https://linkedin.com/in/..." />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-operador">Operador vinculado</Label>
        <Select name="operador_id" defaultValue="none">
          <SelectTrigger id="c-operador"><SelectValue placeholder="Sin operador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin operador</SelectItem>
            {operadores.map((op) => (
              <SelectItem key={op.id} value={op.id}>{op.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-estilo">Estilo de negociación</Label>
        <Select name="estilo_negociacion" defaultValue="none">
          <SelectTrigger id="c-estilo"><SelectValue placeholder="Sin definir" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin definir</SelectItem>
            <SelectItem value="colaborativo">Colaborativo</SelectItem>
            <SelectItem value="competitivo">Competitivo</SelectItem>
            <SelectItem value="analitico">Analítico</SelectItem>
            <SelectItem value="expresivo">Expresivo</SelectItem>
            <SelectItem value="evitador">Evitador</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-notas">Notas</Label>
        <Textarea id="c-notas" name="notas_perfil" placeholder="Observaciones..." rows={2} />
      </div>
      <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
        {submitting ? "Creando..." : "Crear Contacto"}
      </Button>
    </form>
  );
}
