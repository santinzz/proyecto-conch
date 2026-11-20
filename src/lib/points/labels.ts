import type { EntryType } from "@/generated/prisma/enums";

/** Nombre en español de cada tipo de movimiento. */
export const ENTRY_LABELS: Record<EntryType, { label: string; emoji: string }> = {
  PURCHASE: { label: "Compra en el stand", emoji: "🛍️" },
  BRING_CONTAINER: { label: "Trajiste tu envase", emoji: "♻️" },
  RECYCLE: { label: "Reciclaje", emoji: "🗑️" },
  BILL_REDUCTION: { label: "Ahorro en recibo", emoji: "💡" },
  CHALLENGE: { label: "Reto completado", emoji: "🏆" },
  REDEEM: { label: "Canje", emoji: "🎁" },
  DONATION: { label: "Donación a árboles", emoji: "🌳" },
  ADJUSTMENT: { label: "Ajuste", emoji: "✏️" },
};
