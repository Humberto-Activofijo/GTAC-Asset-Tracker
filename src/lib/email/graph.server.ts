// Envío de correo server-side mediante Microsoft Graph (Outlook / Microsoft 365).
// Las credenciales viven únicamente en el entorno del servidor; nunca en el frontend.

export type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sender: string;
  recipients: string[];
};

export type EmailOutcome =
  | { status: "SENT" }
  | { status: "PENDING"; error: string }
  | { status: "FAILED"; error: string };

/** Devuelve la configuración completa, o null con el motivo si aún falta algo. */
export function readGraphConfig(): { config: GraphConfig | null; missing: string[] } {
  const tenantId = process.env["MS_GRAPH_TENANT_ID"]?.trim() ?? "";
  const clientId = process.env["MS_GRAPH_CLIENT_ID"]?.trim() ?? "";
  const clientSecret = process.env["MS_GRAPH_CLIENT_SECRET"]?.trim() ?? "";
  const sender = process.env["ALERT_EMAIL_SENDER"]?.trim() ?? "";
  const recipients = (process.env["ALERT_EMAIL_RECIPIENTS"] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@"));

  const missing: string[] = [];
  if (!tenantId) missing.push("MS_GRAPH_TENANT_ID");
  if (!clientId) missing.push("MS_GRAPH_CLIENT_ID");
  if (!clientSecret) missing.push("MS_GRAPH_CLIENT_SECRET");
  if (!sender) missing.push("ALERT_EMAIL_SENDER");
  if (recipients.length === 0) missing.push("ALERT_EMAIL_RECIPIENTS");

  if (missing.length > 0) return { config: null, missing };
  return { config: { tenantId, clientId, clientSecret, sender, recipients }, missing: [] };
}

async function getAccessToken(config: GraphConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Autenticación Microsoft fallida [${response.status}]: ${text.slice(0, 400)}`);
  }
  const token = (JSON.parse(text) as { access_token?: string }).access_token;
  if (!token) throw new Error("Microsoft no devolvió un token de acceso.");
  return token;
}

/**
 * Envía un correo HTML. Si aún no hay configuración de Microsoft 365, devuelve
 * PENDING sin lanzar error: la alerta sigue existiendo dentro de la aplicación.
 */
export async function sendAlertEmail(subject: string, html: string): Promise<EmailOutcome> {
  const { config, missing } = readGraphConfig();
  if (!config) {
    return {
      status: "PENDING",
      error: `Configuración de correo pendiente. Falta: ${missing.join(", ")}.`,
    };
  }

  try {
    const token = await getAccessToken(config);
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: html },
            toRecipients: config.recipients.map((address) => ({ emailAddress: { address } })),
          },
          saveToSentItems: true,
        }),
      },
    );
    if (!response.ok) {
      const errorBody = await response.text();
      return {
        status: "FAILED",
        error: `Microsoft Graph respondió ${response.status}: ${errorBody.slice(0, 400)}`,
      };
    }
    return { status: "SENT" };
  } catch (error) {
    return { status: "FAILED", error: error instanceof Error ? error.message : "Error de envío." };
  }
}
