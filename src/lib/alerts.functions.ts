import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: Function; from: Function }; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("No fue posible verificar los permisos.");
  if (!data) throw new Error("Solo un administrador puede realizar esta operación.");
}

export type TransitCheckOutcome = {
  assets_reviewed: number;
  alerts_created: number;
  alerts_existing: number;
  errors: number;
  emails_sent: number;
  email_errors: number;
};

/**
 * Revisión manual de tránsito +48 h. Crea únicamente las alertas faltantes y
 * envía correo solo por las alertas nuevas de esta ejecución.
 */
export const runTransitCheckWithEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TransitCheckOutcome> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);

    const { data, error } = await ctx.supabase.rpc("run_transit_48h_check");
    if (error) throw new Error((error as { message: string }).message);
    const row = (
      data as
        | {
            assets_reviewed: number;
            alerts_created: number;
            alerts_existing: number;
            errors: number;
            created_ids: string[] | null;
          }[]
        | null
    )?.[0];
    if (!row) throw new Error("No fue posible ejecutar la revisión.");

    const { notifyAlertById } = await import("@/lib/email/alerts-email.server");
    let emailsSent = 0;
    let emailErrors = 0;
    for (const alertId of row.created_ids ?? []) {
      try {
        const result = await notifyAlertById(alertId);
        if (result.status === "SENT") emailsSent += 1;
        else if (result.status !== "SKIPPED") emailErrors += 1;
      } catch (sendError) {
        console.error("[alerts] fallo de notificación:", sendError);
        emailErrors += 1;
      }
    }

    return {
      assets_reviewed: row.assets_reviewed,
      alerts_created: row.alerts_created,
      alerts_existing: row.alerts_existing,
      errors: row.errors,
      emails_sent: emailsSent,
      email_errors: emailErrors,
    };
  });

/**
 * Notifica las alertas de omisión generadas por un movimiento recién confirmado.
 * Un fallo de correo no revierte el movimiento ni elimina la alerta.
 */
export const notifyMovementAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ movementId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: movement } = await supabaseAdmin
      .from("movements")
      .select("id, performed_by")
      .eq("id", data.movementId)
      .maybeSingle();
    if (!movement) throw new Error("El movimiento no existe.");
    if (movement.performed_by !== ctx.userId) {
      throw new Error("Solo quien registró el movimiento puede notificar sus alertas.");
    }

    const { data: alerts } = await supabaseAdmin
      .from("alerts")
      .select("id")
      .eq("movement_id", data.movementId)
      .neq("email_status", "SENT");

    const { notifyAlertById } = await import("@/lib/email/alerts-email.server");
    let sent = 0;
    let failed = 0;
    for (const alert of alerts ?? []) {
      try {
        const result = await notifyAlertById(alert.id);
        if (result.status === "SENT") sent += 1;
        else if (result.status !== "SKIPPED") failed += 1;
      } catch (sendError) {
        console.error("[alerts] fallo de notificación:", sendError);
        failed += 1;
      }
    }
    return { sent, failed };
  });

/** Reintento manual de notificación; exclusivo de administradores. */
export const retryAlertEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ alertId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { notifyAlertById } = await import("@/lib/email/alerts-email.server");
    return await notifyAlertById(data.alertId);
  });
