// Recuperación de contraseña: genera el enlace de un solo uso en el servidor y lo
// envía por la cuenta de correo conectada. Responde siempre igual para no revelar
// qué correos existen.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { sendGmailMessage } from "@/lib/email/gmail.server";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  redirectTo: z.string().trim().url().max(500),
});

const GENERIC_OK = {
  ok: true,
  message:
    "Si el correo pertenece a una cuenta registrada, recibirás un enlace para restablecer tu contraseña.",
};

// Límite simple por correo (mejor esfuerzo, en memoria del proceso).
const attempts = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  return false;
}

function emailHtml(link: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;">
    <h2 style="font-size:18px;margin:0 0 8px;">GTAC CAT</h2>
    <p style="margin:0 0 4px;color:#666;">Control de Activos y Trazabilidad</p>
    <p style="margin:16px 0 12px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
    <p style="margin:0 0 20px;">
      <a href="${link}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Establecer nueva contraseña</a>
    </p>
    <p style="margin:0 0 12px;color:#666;font-size:12px;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${link}</p>
    <p style="margin:0;color:#666;font-size:12px;">El enlace es de un solo uso y caduca en 1 hora. Si no solicitaste el cambio, puedes ignorar este correo.</p>
  </div>`;
}

export const Route = createFileRoute("/api/public/password-reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, message: "Solicitud inválida." }, { status: 400 });
        }

        if (rateLimited(parsed.email)) {
          return Response.json(
            { ok: false, message: "Demasiados intentos. Espera unos minutos antes de volver a intentar." },
            { status: 429 },
          );
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email: parsed.email,
            options: { redirectTo: parsed.redirectTo },
          });

          const actionLink = link?.properties?.action_link;
          if (error || !actionLink) {
            // Cuenta inexistente u otro motivo: respuesta genérica.
            console.warn("[password-reset] no se generó el enlace:", error?.message ?? "sin enlace");
            return Response.json(GENERIC_OK);
          }

          const outcome = await sendGmailMessage({
            to: [parsed.email],
            subject: "Restablece tu contraseña — GTAC CAT",
            html: emailHtml(actionLink),
          });

          if (outcome.status !== "SENT") {
            console.error("[password-reset] fallo de envío:", outcome.error);
            return Response.json(
              {
                ok: false,
                message:
                  "No fue posible enviar el correo de recuperación. Contacta al administrador para obtener un enlace.",
              },
              { status: 502 },
            );
          }

          return Response.json(GENERIC_OK);
        } catch (thrown) {
          console.error("[password-reset] error inesperado:", thrown);
          return Response.json(
            { ok: false, message: "No fue posible enviar el correo de recuperación. Intenta más tarde." },
            { status: 500 },
          );
        }
      },
    },
  },
});
