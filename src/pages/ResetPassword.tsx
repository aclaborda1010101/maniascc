import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Supabase parses the recovery token from URL hash automatically and emits PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Contraseña demasiado corta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "No coinciden", description: "Las contraseñas no son iguales.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Contraseña actualizada", description: "Ya puedes iniciar sesión." });
      await supabase.auth.signOut();
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[hsl(var(--ava-via))] opacity-20 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-[hsl(var(--ava-from))] opacity-20 blur-[140px]" />

      <div className="card-premium relative w-full max-w-md p-8 md:p-10">
        <div className="text-center mb-8">
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 ava-gradient rounded-2xl glow-ring" />
            <Sparkles className="relative h-9 w-9 text-white drop-shadow" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="ava-text-gradient">Nueva contraseña</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ready ? "Define una contraseña nueva para tu cuenta." : "Validando enlace de recuperación..."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nueva contraseña
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={!ready}
              className="rounded-2xl h-11 bg-secondary/40 border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-xs uppercase tracking-wider text-muted-foreground">
              Confirmar contraseña
            </Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              disabled={!ready}
              className="rounded-2xl h-11 bg-secondary/40 border-border/60"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-2xl ava-gradient text-white font-semibold hover:opacity-95 border-0 mt-2"
            disabled={loading || !ready}
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </Button>

          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
            onClick={() => navigate("/login")}
          >
            Volver al inicio de sesión
          </button>
        </form>
      </div>
    </div>
  );
}
