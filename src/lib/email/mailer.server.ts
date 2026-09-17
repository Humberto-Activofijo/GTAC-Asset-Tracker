// Selector de proveedor de correo. Solo servidor.
// Prioridad: cuenta de Gmail conectada → Microsoft Graph (Outlook corporativo) → PENDING.
import { readGraphConfig, sendAlertEmail as sendViaGraph, type EmailOutcome } from "./graph.server";
import { readGmailConfig, sendGmailMessage } from "./gmail.server";

export type { EmailOutcome };

export function readAlertRecipients(): string[] {
  return (process.env["ALERT_EMAIL_RECIPIENTS"] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@"));
}

/** Envía la notificación de una alerta por el proveedor disponible. */
export async function sendAlertEmail(subject: string, html: string): Promise<EmailOutcome> {
  const gmail = readGmailConfig();
  if (gmail.config) {
    const recipients = readAlertRecipients();
    if (recipients.length === 0) {
      return { status: "PENDING", error: "Configuración de correo pendiente. Falta: ALERT_EMAIL_RECIPIENTS." };
    }
    return sendGmailMessage({ to: recipients, subject, html });
  }

  const graph = readGraphConfig();
  if (graph.config) return sendViaGraph(subject, html);

  return {
    status: "PENDING",
    error: `Configuración de correo pendiente. Falta: ${gmail.missing.join(", ")}.`,
  };
}
