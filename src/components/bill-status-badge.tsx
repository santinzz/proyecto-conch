import type { BillStatus } from "@/generated/prisma/enums";
import { STATUS_LABELS } from "@/lib/bills/labels";

export function BillStatusBadge({ status }: { status: BillStatus }) {
  const { label, className } = STATUS_LABELS[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
