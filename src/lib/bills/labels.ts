import type { BillKind, BillStatus } from "@/generated/prisma/enums";

export const KIND_LABELS: Record<BillKind, { label: string; short: string; unit: string; emoji: string }> = {
  ELECTRICITY: { label: "Luz (CFE)", short: "Luz", unit: "kWh", emoji: "💡" },
  WATER: { label: "Agua", short: "Agua", unit: "m³", emoji: "💧" },
};

export const STATUS_LABELS: Record<BillStatus, { label: string; className: string }> = {
  DRAFT: { label: "Falta confirmar", className: "bg-amber-100 text-amber-900" },
  PENDING: { label: "En revisión", className: "bg-sky-100 text-sky-900" },
  APPROVED: { label: "Aprobado", className: "bg-emerald-100 text-emerald-900" },
  REJECTED: { label: "Rechazado", className: "bg-red-100 text-red-900" },
};

const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Las fechas del periodo se guardan a medianoche UTC: se muestran en UTC para no correr un día. */
export function formatPeriodDate(date: Date): string {
  return dateFmt.format(date);
}

/** Date → "YYYY-MM-DD" para <input type="date">. */
export function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}
