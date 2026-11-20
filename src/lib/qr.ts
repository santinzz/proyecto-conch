// QR del ticket del stand: `saleId.nonce.expiresAt.firma`
//   - expiresAt: segundos Unix
//   - firma: HMAC-SHA256 (base64url) de `saleId.nonce.expiresAt` con QR_SECRET
// El QR lleva una URL de la app (…/escanear?t=<token>) para que también funcione
// con la cámara normal del teléfono.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const QR_TTL_SECONDS = 15 * 60;

export type VerifyResult =
  | { ok: true; saleId: string; nonce: string; expiresAt: Date }
  | { ok: false; reason: "INVALID" | "EXPIRED" };

const PART = /^[A-Za-z0-9_-]+$/;

export function getQrSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.QR_SECRET;
  if (!secret || secret.length < 32) throw new Error("Define QR_SECRET (mínimo 32 caracteres) en el entorno");
  return secret;
}

export function newNonce(): string {
  return randomBytes(16).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signTicket(input: { saleId: string; nonce: string; expiresAt: Date }, secret: string): string {
  if (!PART.test(input.saleId) || !PART.test(input.nonce)) throw new Error("saleId o nonce no válidos");
  const payload = `${input.saleId}.${input.nonce}.${Math.floor(input.expiresAt.getTime() / 1000)}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Verifica firma (en tiempo constante) y vigencia. No consulta la base de datos. */
export function verifyTicket(token: string, secret: string, now: Date = new Date()): VerifyResult {
  const parts = token.trim().split(".");
  if (parts.length !== 4 || !parts.every((p) => PART.test(p))) return { ok: false, reason: "INVALID" };
  const [saleId, nonce, exp, signature] = parts;
  if (!/^\d{1,12}$/.test(exp)) return { ok: false, reason: "INVALID" };

  const expected = Buffer.from(sign(`${saleId}.${nonce}.${exp}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "INVALID" };
  }

  const expiresAt = new Date(Number(exp) * 1000);
  if (now.getTime() >= expiresAt.getTime()) return { ok: false, reason: "EXPIRED" };
  return { ok: true, saleId, nonce, expiresAt };
}

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
