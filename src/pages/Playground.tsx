import { FlaskConical } from "lucide-react";

export default function Playground() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          Playground
        </h1>
        <p className="text-sm text-muted-foreground">Espacio de experimentación y pruebas</p>
      </div>
    </div>
  );
}
