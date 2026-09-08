import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/modules/layout/PageHeader";

export const Route = createFileRoute("/_authenticated/cuenta")({
  head: () => ({
    meta: [
      { title: "Mi cuenta — GTAC" },
      { name: "description", content: "Cambia la contraseña de tu cuenta GTAC." },
      { property: "og:title", content: "Mi cuenta — GTAC" },
      { property: "og:description", content: "Cambia la contraseña de tu cuenta GTAC." },
    ],
  }),
  component: CuentaPage,
});

function CuentaPage() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        // @ts-expect-error current_password es requerido por Cloud para cambios con sesión activa
        current_password: current,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setCurrent("");
      setPassword("");
      setConfirm("");
      toast.success("Contraseña actualizada.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Mi cuenta" description="Actualiza tu contraseña de acceso." />
      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-4 rounded-xl border border-border bg-card p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="current">Contraseña actual</Label>
          <Input
            id="current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Nueva contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </form>
    </>
  );
}
