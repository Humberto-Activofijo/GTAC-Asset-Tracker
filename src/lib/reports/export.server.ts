import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

import { APP_TIME_ZONE } from "@/lib/datetime";

const BATCH_SIZE = 5000;
const MAX_ROWS = 250_000;

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("es-MX", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const dateTimeFmt = new Intl.DateTimeFormat("es-MX", {
  timeZone: APP_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

/** Las marcas de tiempo se guardan en UTC y se exportan en horario de CDMX. */
export function cdmxDate(value: string | null): string {
  return value ? dateFmt.format(new Date(value)) : "";
}
export function cdmxTime(value: string | null): string {
  return value ? timeFmt.format(new Date(value)) : "";
}
export function cdmxDateTime(value: string | null): string {
  return value ? dateTimeFmt.format(new Date(value)) : "";
}

function isOpaqueKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** Cliente con el token del usuario: las funciones aplican rol y RLS. */
export function clientForToken(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Falta la configuración del backend.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${token}`);
        if (isOpaqueKey(key)) headers.set("apikey", key);
        else headers.set("apikey", key);
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.split(".").length === 3 ? token : null;
}

type AnyClient = ReturnType<typeof clientForToken>;

/** El permiso se comprueba en el servidor, no en la interfaz. */
export async function assertAdmin(client: AnyClient): Promise<void> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("Sesión no válida.");
  const { data, error } = await (
    client.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  ).call(client, "has_role", { _user_id: userData.user.id, _role: "admin" });
  if (error) throw new Error("No fue posible verificar los permisos.");
  if (data !== true) throw new Error("Solo un administrador puede exportar este reporte.");
}

/**
 * Recorre la función de reporte por lotes en el servidor: nunca se materializa
 * el conjunto completo en el navegador.
 */
export async function fetchAllRows<T>(
  client: AnyClient,
  fn: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH_SIZE) {
    const { data, error } = await (
      client.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    ).call(client, fn, { ...params, _limit: BATCH_SIZE, _offset: offset });
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }
  return all;
}

export function workbookResponse(
  rows: (string | number)[][],
  sheetName: string,
  fileName: string,
): Response {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function fileStamp(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}
