// Funciones del QR que también corren en el navegador (sin node:crypto).

/** URL que va dentro del QR. */
export function ticketUrl(baseUrl: string, token: string): string {
  const url = new URL("/escanear", baseUrl);
  url.searchParams.set("t", token);
  return url.toString();
}

/** Saca el token de lo que leyó la cámara: una URL de la app o el token solo. */
export function extractTicketToken(scanned: string): string | null {
  const text = scanned.trim();
  try {
    const url = new URL(text);
    return url.searchParams.get("t");
  } catch {
    return text.split(".").length === 4 ? text : null;
  }
}

/** URL que va dentro del QR fijo del contenedor de reciclaje. */
export function binUrl(baseUrl: string, code: string): string {
  const url = new URL("/reciclar", baseUrl);
  url.searchParams.set("bin", code);
  return url.toString();
}

/** Código del contenedor: "bin:CAMPUS-01" (SPEC.md) o la URL de /reciclar. null si no es un contenedor. */
export function extractBinCode(scanned: string): string | null {
  const text = scanned.trim();
  if (/^bin:/i.test(text)) return text.slice(4).trim() || null;
  try {
    const url = new URL(text);
    return url.pathname === "/reciclar" ? url.searchParams.get("bin") : null;
  } catch {
    return null;
  }
}
