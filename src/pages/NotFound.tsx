import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-bold text-accent">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página no encontrada</p>
        <p className="mb-6 text-sm text-muted-foreground">La página que buscas no existe o ha sido movida.</p>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/dashboard"><Home className="mr-2 h-4 w-4" /> Volver al Dashboard</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
