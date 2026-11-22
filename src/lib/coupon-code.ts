// Código y QR de los cupones; también corre en el navegador.

const CODE_RE = /^ECO-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Texto dentro del QR del cupón. */
export function couponQrContent(code: string): string {
  return `cupon:${code}`;
}

/**
 * Normaliza lo que leyó la cámara o escribió el operador: "cupon:ECO-7KQ2-MX4P",
 * "eco 7kq2 mx4p" o "ECO7KQ2MX4P" → "ECO-7KQ2-MX4P". null si no parece cupón.
 */
export function normalizeCouponCode(raw: string): string | null {
  const text = raw.trim().replace(/^cup[oó]n:/i, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^ECO[A-Z0-9]{8}$/.test(text)) return null;
  const code = `ECO-${text.slice(3, 7)}-${text.slice(7, 11)}`;
  return CODE_RE.test(code) ? code : null;
}
