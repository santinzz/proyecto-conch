import type { EcoScore } from "@/lib/points/eco-score";

const STYLES: Record<EcoScore, string> = {
  A: "bg-green-600 text-white",
  B: "bg-lime-500 text-white",
  C: "bg-amber-400 text-amber-950",
};

/** Insignia del Eco Score de un producto. */
export function EcoBadge({ score }: { score: EcoScore | null }) {
  if (!score) {
    return <span className="rounded px-1.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border">Sin Eco</span>;
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${STYLES[score]}`} title={`Eco Score ${score}`}>
      Eco {score}
    </span>
  );
}
