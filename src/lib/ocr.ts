import "server-only";

// Texto de un recibo para src/lib/bills/parse.ts.
// - PDF digital (como el recibo en línea de CFE): se extrae su texto con unpdf.
// - Foto: OCR en español con Tesseract.js. Descarga el idioma la primera vez y lo
//   guarda en la carpeta temporal (en Vercel es la única con permiso de escritura).
// Si falla o tarda demasiado devuelve null: el usuario escribe los datos y el
// operador revisa con más cuidado (SPEC.md, Fase 4).
import { tmpdir } from "node:os";
import type { BillMimeType } from "@/lib/bills/file";

export type OcrText = { text: string; confidence: number }; // confianza de 0 a 1

const OCR_TIMEOUT_MS = 45_000;

async function pdfText(bytes: Uint8Array): Promise<OcrText | null> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  // Un PDF escaneado no trae texto: se trata como "no se pudo leer".
  return text.replace(/\s/g, "").length >= 20 ? { text, confidence: 1 } : null;
}

async function imageText(bytes: Uint8Array): Promise<OcrText> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, { cachePath: tmpdir() });
  try {
    const { data } = await worker.recognize(Buffer.from(bytes));
    return { text: data.text, confidence: Math.max(0, Math.min(1, data.confidence / 100)) };
  } finally {
    await worker.terminate();
  }
}

export async function readBillText(bytes: Uint8Array, mimeType: BillMimeType): Promise<OcrText | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), OCR_TIMEOUT_MS);
  });
  try {
    const work = mimeType === "application/pdf" ? pdfText(bytes) : imageText(bytes);
    return await Promise.race([work, timeout]);
  } catch (e) {
    console.error("No se pudo leer el recibo:", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
