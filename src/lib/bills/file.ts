// Archivo del recibo: tipo real (por sus primeros bytes), tamaño y huella SHA-256.
import { createHash } from "node:crypto";

export { MAX_FILE_BYTES } from "./limits";

export type BillMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/**
 * Tipo del archivo según su contenido. No se confía en el nombre ni en el tipo
 * que manda el navegador: así nadie sube un HTML disfrazado de foto.
 */
export function detectFileType(bytes: Uint8Array): BillMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  return null;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
