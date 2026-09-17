// Composición y envío de las notificaciones de alertas. Solo servidor.
import { sendAlertEmail } from "./mailer.server";

const formatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  dateStyle: "medium",
  timeStyle: "short",
});

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatter.format(date)} (CDMX)`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function table(rows: [string, unknown][]): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;">${escapeHtml(label)}</td><td style="padding:4px 0;"><strong>${escapeHtml(value)}</strong></td></tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">${body}</table>`;
}

export type NotifyResult = { status: "SENT" | "PENDING" | "FAILED" | "SKIPPED"; error?: string };

/**
 * Notifica una alerta por correo una sola vez. Si ya fue enviada devuelve
 * SKIPPED; un fallo nunca revierte el movimiento ni elimina la alerta.
 */
export async function notifyAlertById(alertId: string): Promise<NotifyResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: alert, error } = await supabaseAdmin
    .from("alerts")
    .select("id, type, message, metadata, created_at, email_status, asset_id, movement_id, site_id")
    .eq("id", alertId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!alert) throw new Error("La alerta no existe.");
  if (alert.email_status === "SENT") return { status: "SKIPPED" };

  const { data: asset } = await supabaseAdmin
    .from("assets")
    .select("asset_number, model, serial_number")
    .eq("id", alert.asset_id)
    .maybeSingle();

  const movement = alert.movement_id
    ? (
        await supabaseAdmin
          .from("movements")
          .select("action, site_name, previous_site_name, occurred_at, performed_by_email")
          .eq("id", alert.movement_id)
          .maybeSingle()
      ).data
    : null;

  const meta = (alert.metadata ?? {}) as Record<string, unknown>;
  let subject: string;
  let rows: [string, unknown][];

  if (alert.type === "TRANSITO_48H") {
    const departedAt = (movement?.occurred_at as string | undefined) ?? (meta["departed_at"] as string | undefined) ?? null;
    const hours = departedAt
      ? Math.round(((Date.now() - new Date(departedAt).getTime()) / 3_600_000) * 10) / 10
      : null;
    subject = "[GTAC] Alerta: activo en tránsito por más de 48 horas";
    rows = [
      ["Número de activo", asset?.asset_number],
      ["Modelo", asset?.model],
      ["Serie", asset?.serial_number],
      ["Sitio de origen", movement?.site_name ?? meta["origin_site_name"]],
      ["Fecha/hora de salida", fmt(departedAt)],
      ["Horas en tránsito", hours != null ? `${hours} h` : "—"],
      ["Usuario que registró la salida", movement?.performed_by_email ?? meta["performed_by_email"]],
      ["ID de alerta", alert.id],
    ];
  } else {
    subject = "[GTAC] Alerta: omisión de protocolo";
    rows = [
      ["Activo", asset?.asset_number],
      ["Acción", movement?.action ?? meta["action"]],
      ["Sitio anterior", movement?.previous_site_name ?? meta["previous_site_name"]],
      ["Sitio nuevo", movement?.site_name ?? meta["new_site_name"]],
      ["Usuario", movement?.performed_by_email ?? meta["performed_by_email"]],
      ["Fecha/hora", fmt((movement?.occurred_at as string | undefined) ?? alert.created_at)],
      ["ID de alerta", alert.id],
    ];
  }

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;">
    <h2 style="font-size:16px;margin:0 0 8px;">${escapeHtml(subject.replace("[GTAC] ", ""))}</h2>
    <p style="margin:0 0 12px;">${escapeHtml(alert.message)}</p>
    ${table(rows)}
    <p style="margin-top:16px;color:#666;font-size:12px;">GTAC — Trazabilidad de Activos. Todas las fechas se muestran en horario de Ciudad de México.</p>
  </div>`;

  const outcome = await sendAlertEmail(subject, html);

  const patch =
    outcome.status === "SENT"
      ? { email_status: "SENT" as const, email_sent_at: new Date().toISOString(), email_error: null }
      : {
          email_status: outcome.status === "PENDING" ? ("PENDING" as const) : ("FAILED" as const),
          email_error: outcome.error,
        };

  const { error: updateError } = await supabaseAdmin.from("alerts").update(patch).eq("id", alertId);
  if (updateError) console.error("[alerts] no se pudo guardar el estado de correo:", updateError.message);

  return outcome.status === "SENT"
    ? { status: "SENT" }
    : { status: outcome.status, error: outcome.error };
}
