// Puente de autenticación: reenvía las peticiones de inicio de sesión / sesión
// al servicio de autenticación desde el servidor de la app. Se usa solo cuando la
// red del usuario bloquea la conexión directa del navegador a ese servicio.
import { createFileRoute } from "@tanstack/react-router";

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
  "origin",
  "referer",
]);

async function proxy({ request, params }: { request: Request; params: { _splat?: string } }) {
  const base = process.env["SUPABASE_URL"];
  if (!base) {
    return Response.json({ error: "auth_proxy_unavailable" }, { status: 503 });
  }

  const incoming = new URL(request.url);
  const target = new URL(`${base.replace(/\/$/, "")}/auth/v1/${params._splat ?? ""}`);
  target.search = incoming.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  if (!headers.has("apikey")) {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (key) headers.set("apikey", key);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.text() : null,
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "content-encoding" || lower === "content-length" || lower === "transfer-encoding") {
      return;
    }
    responseHeaders.set(key, value);
  });

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/public/auth/$")({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      DELETE: proxy,
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
