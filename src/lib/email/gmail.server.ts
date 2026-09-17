// Envío de correo server-side mediante la cuenta de Gmail conectada (connector gateway).
// Las credenciales viven únicamente en el entorno del servidor; nunca en el frontend.
import type { EmailOutcome } from "./graph.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export type GmailConfig = { lovableApiKey: string; connectionKey: string; sender: string };

export function readGmailConfig(): { config: GmailConfig | null; missing: string[] } {
  const lovableApiKey = process.env["LOVABLE_API_KEY"]?.trim() ?? "";
  const connectionKey = process.env["GOOGLE_MAIL_API_KEY"]?.trim() ?? "";
  const sender = process.env["ALERT_EMAIL_SENDER"]?.trim() ?? "";

  const missing: string[] = [];
  if (!lovableApiKey) missing.push("LOVABLE_API_KEY");
  if (!connectionKey) missing.push("GOOGLE_MAIL_API_KEY");
  if (!sender) missing.push("ALERT_EMAIL_SENDER");

  if (missing.length > 0) return { config: null, missing };
  return { config: { lovableApiKey, connectionKey, sender }, missing: [] };
}

const b64 = (value: string) =>
  btoa(Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join(""));

/** Codifica cabeceras con acentos según RFC 2047. */
const header = (value: string) =>
  /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;

function buildRawMessage(params: {
  from: string;
  fromName: string;
  to: string[];
  subject: string;
  html: string;
}): string {
  const message = [
    `From: ${header(params.fromName)} <${params.from}>`,
    `To: ${params.to.join(", ")}`,
    `Subject: ${header(params.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    params.html,
  ].join("\r\n");
  return b64(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Envía un correo HTML desde la cuenta de Gmail conectada. */
export async function sendGmailMessage(params: {
  to: string[];
  subject: string;
  html: string;
  fromName?: string;
}): Promise<EmailOutcome> {
  const { config, missing } = readGmailConfig();
  if (!config) {
    return { status: "PENDING", error: `Configuración de correo pendiente. Falta: ${missing.join(", ")}.` };
  }
  const recipients = params.to.map((value) => value.trim()).filter((value) => value.includes("@"));
  if (recipients.length === 0) {
    return { status: "PENDING", error: "No hay destinatarios configurados." };
  }

  try {
    const raw = buildRawMessage({
      from: config.sender,
      fromName: params.fromName ?? "GTAC CAT",
      to: recipients,
      subject: params.subject,
      html: params.html,
    });

    const response = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.lovableApiKey}`,
        "X-Connection-Api-Key": config.connectionKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        status: "FAILED",
        error: `Gmail respondió ${response.status}: ${errorBody.slice(0, 400)}`,
      };
    }
    return { status: "SENT" };
  } catch (error) {
    return { status: "FAILED", error: error instanceof Error ? error.message : "Error de envío." };
  }
}
