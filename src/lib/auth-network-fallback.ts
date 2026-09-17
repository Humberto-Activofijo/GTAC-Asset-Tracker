// Algunas redes corporativas (VPN, antivirus, filtros de contenido) bloquean el
// dominio del servicio de autenticación. En ese caso el navegador ni siquiera
// logra enviar la petición ("Failed to fetch"). Aquí reintentamos la misma
// petición a través del servidor de la app, en el mismo dominio del sitio.
const AUTH_PATH = "/auth/v1/";

let installed = false;

export function installAuthNetworkFallback(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const supabaseUrl = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.replace(
    /\/$/,
    "",
  );
  if (!supabaseUrl) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    const isAuthCall = url.startsWith(`${supabaseUrl}${AUTH_PATH}`);
    if (!isAuthCall) return originalFetch(input as RequestInfo, init);

    try {
      return await originalFetch(input as RequestInfo, init);
    } catch (networkError) {
      const fallbackUrl = url.replace(`${supabaseUrl}${AUTH_PATH}`, "/api/public/auth/");
      try {
        if (typeof input === "string" || input instanceof URL) {
          return await originalFetch(fallbackUrl, init);
        }
        return await originalFetch(new Request(fallbackUrl, input), init);
      } catch {
        throw networkError;
      }
    }
  };
}
