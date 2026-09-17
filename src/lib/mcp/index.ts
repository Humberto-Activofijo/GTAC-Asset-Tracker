import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getAssetTool from "./tools/get-asset";
import listAlertsTool from "./tools/list-alerts";
import listAssetsTool from "./tools/list-assets";
import listMovementsTool from "./tools/list-movements";
import listSitesTool from "./tools/list-sites";

// El emisor OAuth debe ser el host directo del servicio de autenticación.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "gtac-asset-tracker",
  title: "GTAC: Asset Tracker",
  version: "0.1.0",
  instructions:
    "Herramientas de consulta de GTAC CAT (Control de Activos y Trazabilidad). Permiten revisar sitios, activos, movimientos y alertas. Cada persona ve únicamente la información que su cuenta de GTAC CAT tiene permitida: los ingenieros solo sus sitios asignados y las alertas son exclusivas de administradores. Las fechas se guardan en UTC; conviértelas a America/Mexico_City al mostrarlas.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSitesTool, listAssetsTool, getAssetTool, listMovementsTool, listAlertsTool],
});
