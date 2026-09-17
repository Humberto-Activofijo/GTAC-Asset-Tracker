import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GtacBrand } from "@/modules/layout/AppLayout";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso — GTAC Trazabilidad de Activos" },
      {
        name: "description",
        content: "Inicia sesión en GTAC para dar seguimiento a los activos fijos de tus sitios.",
      },
      { property: "og:title", content: "Acceso — GTAC Trazabilidad de Activos" },
      {
        property: "og:description",
        content: "Inicia sesión en GTAC para dar seguimiento a los activos fijos de tus sitios.",
      },
    ],
  }),
  component: AuthPage,
});

const NETWORK_MESSAGE =
  "No se pudo contactar al servidor. Revisa tu conexión, VPN o bloqueador de anuncios y vuelve a intentar.";

type AuthFailure = { message: string; detail: string | null; retryable: boolean };

/** Traduce un error de autenticación a un mensaje claro, distinguiendo fallos de red. */
function describeAuthError(error: unknown, fallback: string): AuthFailure {
  const raw = error as { message?: string; code?: string; status?: number; name?: string } | null;
  const message = raw?.message ?? "";
  const code = raw?.code ?? "";
  const isNetwork =
    raw?.name === "AuthRetryableFetchError" ||
    raw?.status === 0 ||
    /failed to fetch|network|load failed|fetch failed/i.test(message);

  const stamp = new Date().toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" });

  if (isNetwork || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    return {
      message: NETWORK_MESSAGE,
      detail: `${stamp} · ${message || "sin respuesta del servidor"}`,
      retryable: true,
    };
  }
  if (code === "over_email_send_rate_limit" || raw?.status === 429) {
    return {
      message: "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
      detail: null,
      retryable: false,
    };
  }
  if (code === "invalid_credentials" || raw?.status === 400) {
    return { message: fallback, detail: null, retryable: false };
  }
  return { message: fallback, detail: message ? `${stamp} · ${message}` : null, retryable: false };
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      let result: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
      try {
        result = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
      } catch (thrown) {
        setError(describeAuthError(thrown, "No fue posible iniciar sesión."));
        return;
      }
      const { data, error: signInError } = result;
      if (signInError || !data.user) {
        setError(describeAuthError(signInError, "Correo o contraseña incorrectos."));
        return;
      }

      // Validar que el perfil esté activo después de autenticar.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setError({
          message: "Tu cuenta no tiene un perfil válido. Contacta al administrador.",
          detail: null,
          retryable: false,
        });
        return;
      }
      if (!profile.active) {
        await supabase.auth.signOut();
        setError({
          message: "Tu cuenta está desactivada. Contacta al administrador.",
          detail: null,
          retryable: false,
        });
        return;
      }

      navigate({ to: "/inicio", replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleRecover(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: recoverError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (recoverError) {
        setError("No fue posible enviar el correo de recuperación. Intenta más tarde.");
        return;
      }
      setInfo("Si el correo pertenece a una cuenta registrada, recibirás un enlace para restablecer tu contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <GtacBrand />
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          {mode === "login" ? "Iniciar sesión" : "Recuperar contraseña"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Acceso exclusivo para cuentas autorizadas."
            : "Te enviaremos un enlace para establecer una nueva contraseña."}
        </p>

        <form
          onSubmit={mode === "login" ? handleLogin : handleRecover}
          className="mt-6 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {mode === "login" && (
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          {info && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{info}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Entrar" : "Enviar enlace"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "recover" : "login");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "login" ? "¿Olvidaste tu contraseña?" : "Volver a iniciar sesión"}
        </button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          No hay registro público. Las cuentas las crea un administrador.
        </p>
      </div>
    </div>
  );
}
