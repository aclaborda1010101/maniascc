import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function TabEmail({ contacto }: { contacto: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Correos electrónicos</CardTitle></CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Mail className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">
              Próximamente: Integración con correo electrónico para ver correspondencia con {contacto.nombre}.
            </p>
            {contacto.email && (
              <a href={`mailto:${contacto.email}`} className="mt-2 inline-block text-xs text-primary hover:underline">
                Enviar email a {contacto.email}
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
