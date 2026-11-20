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
