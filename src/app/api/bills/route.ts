import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import {
  BILL_ERROR_MESSAGES,
  BILL_ERROR_STATUS,
  BillError,
  billKindSchema,
  createBillDraft,
} from "@/lib/bills";
import { detectFileType, MAX_FILE_BYTES, sha256Hex } from "@/lib/bills/file";
import { parseBillText } from "@/lib/bills/parse";
import { db } from "@/lib/db";
import { readBillText } from "@/lib/ocr";
import { rateLimit } from "@/lib/rate-limit";

// El OCR de una foto puede tardar varios segundos.
export const maxDuration = 60;

const errorResponse = (code: BillError["code"]) =>
  NextResponse.json({ error: BILL_ERROR_MESSAGES[code], code }, { status: BILL_ERROR_STATUS[code] });

// POST /api/bills · Cliente · Sube la foto o el PDF; devuelve el borrador con lo leído por el OCR.
export async function POST(request: Request) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  if (!rateLimit(`bills:${auth.user.id}`, 6, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiados recibos seguidos. Espera unos minutos." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = billKindSchema.safeParse(form?.get("kind"));
  if (!(file instanceof File) || !kind.success) {
    return NextResponse.json({ error: "Elige si es de luz o de agua y sube el archivo" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) return errorResponse("FILE_TOO_BIG");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectFileType(bytes);
  if (!mimeType) return errorResponse("UNSUPPORTED_FILE");
  // Revisa el duplicado antes del OCR para no gastar tiempo en leerlo.
  if (await db.bill.findUnique({ where: { fileHash: sha256Hex(bytes) }, select: { id: true } })) {
    return errorResponse("DUPLICATE_FILE");
  }

  const text = await readBillText(bytes, mimeType);
  const ocr = text ? { parsed: parseBillText(text.text, kind.data), confidence: text.confidence } : null;
  try {
    const bill = await createBillDraft(db, { userId: auth.user.id, kind: kind.data, bytes, mimeType, ocr });
    return NextResponse.json({ id: bill.id, ocrRead: ocr !== null }, { status: 201 });
  } catch (e) {
    if (e instanceof BillError) return errorResponse(e.code);
    throw e;
  }
}

// GET /api/bills?status=PENDING · Operador · Cola de validación (sin los archivos).
export async function GET(request: Request) {
  const auth = await authorizeApi(AREA_ROLES.operador);
  if ("response" in auth) return auth.response;

  const status = new URL(request.url).searchParams.get("status") ?? "PENDING";
  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
  }
  const bills = await db.bill.findMany({
    where: { status: status as "PENDING" | "APPROVED" | "REJECTED" },
    orderBy: { submittedAt: "asc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      serviceNumber: true,
      periodStart: true,
      periodEnd: true,
      consumption: true,
      ocrConsumption: true,
      detailedReview: true,
      status: true,
      submittedAt: true,
      user: { select: { name: true } },
    },
  });
  return NextResponse.json({ bills });
}
