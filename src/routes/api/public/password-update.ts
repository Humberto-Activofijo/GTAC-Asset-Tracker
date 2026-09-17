// Cambio de contraseña desde el enlace de recuperación, realizado en el servidor.
// Evita que el navegador del usuario tenga que contactar directamente al servicio
// de autenticación (redes corporativas pueden bloquearlo: "Failed to fetch").
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const bodySchema = z.object({
  accessToken: z.string().min(10).max(4000),
  password: z.string().min(8).max(200),
});

export const Route = createFileRoute("/api/public/password-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return Response.json(
            { ok: false, code: "invalid_request", message: "Solicitud inválida." },
            { status: 400 },
          );
        }

        try {
          const url = process.env["SUPABASE_URL"]!;
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
          const client = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                h.set("apikey", key);
                return fetch(input, { ...init, headers: h });
              },
            },
          });

          const { data: userData, error: userError } = await client.auth.getUser(parsed.accessToken);
          if (userError || !userData.user) {
            return Response.json(
              {
                ok: false,
                code: "expired",
                message:
                  "El enlace expiró o ya fue usado. Solicita uno nuevo desde la pantalla de acceso.",
              },
              { status: 401 },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
            password: parsed.password,
          });

          if (error) {
            const code = (error as { code?: string }).code ?? "";
            if (code === "same_password") {
              return Response.json(
                {
                  ok: false,
                  code,
                  message: "La nueva contraseña debe ser distinta a la anterior.",
                },
                { status: 400 },
              );
            }
            if (code === "weak_password") {
              return Response.json(
                {
                  ok: false,
                  code,
                  message:
                    "La contraseña es demasiado débil o apareció en filtraciones conocidas. Usa otra.",
                },
                { status: 400 },
              );
            }
            console.error("[password-update] error:", error.message);
            return Response.json(
              { ok: false, code: "error", message: error.message },
              { status: 400 },
            );
          }

          return Response.json({ ok: true, message: "Contraseña actualizada." });
        } catch (thrown) {
          console.error("[password-update] error inesperado:", thrown);
          return Response.json(
            {
              ok: false,
              code: "error",
              message: "No fue posible guardar la contraseña. Intenta más tarde.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
