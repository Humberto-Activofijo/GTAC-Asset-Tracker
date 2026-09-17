import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GtacBrand } from "@/modules/layout/AppLayout";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Establecer contraseña — GTAC" },
      { name: "description", content: "Define una nueva contraseña para tu cuenta GTAC." },
      { property: "og:title", content: "Establecer contraseña — GTAC" },
      { property: "og:description", content: "Define una nueva contraseña para tu cuenta GTAC." },
    ],
  }),
  component: ResetPasswordPage,
});

function readTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("access_token") ?? query.get("access_token");
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urlToken = readTokenFromUrl();
    if (urlToken) {
      setToken(urlToken);
      setReady(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setToken((current) => current ?? data.session!.access_token);
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setToken((current) => current ?? session.access_token);
        setReady(true);
      } else if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!token) {
      setError("El enlace expiró o ya fue usado. Solicita uno nuevo desde la pantalla de acceso.");
      return;
    }
    setLoading(true);
    try {
      // El cambio se hace en el servidor de la app: algunas redes corporativas
      // bloquean la conexión directa del navegador al servicio de autenticación.
      const response = await fetch("/api/public/password-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token, password }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.message ?? "No fue posible guardar la contraseña. Intenta más tarde.");
        return;
      }

      // Intentamos iniciar sesión sin interrumpir si la red bloquea la llamada.
      await supabase.auth.refreshSession().catch(() => undefined);
      navigate({ to: "/auth", replace: true });
    } catch {
      setError(
        "No se pudo contactar al servidor. Revisa tu conexión, VPN o bloqueador y vuelve a intentar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <GtacBrand />
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          Establecer contraseña
        </h1>

        {!ready ? (
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Abre esta página desde el enlace que recibiste. Si el enlace expiró, solicita uno nuevo
            desde la pantalla de acceso.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              <Label htmlFor="confirm">Confirmar contraseña</Label>
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
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar contraseña
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
