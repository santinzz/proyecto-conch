"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Confirmar (con las piezas contadas) o rechazar una solicitud de reciclaje. */
export function ClaimReview({ claimId, requested }: { claimId: string; requested: number }) {
  const router = useRouter();
  const [pieces, setPieces] = useState(requested);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string>();

  async function send(action: "approve" | "reject") {
    setError(undefined);
    setPending(action);
    try {
      const res = await fetch(`/api/recycle/${claimId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action, pieces } : { action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Piezas contadas:</span>
        <Button variant="outline" className="size-11 text-xl" onClick={() => setPieces((p) => Math.max(1, p - 1))} aria-label="Una pieza menos">
          −
        </Button>
        <span className="w-10 text-center text-xl font-semibold tabular-nums">{pieces}</span>
        <Button variant="outline" className="size-11 text-xl" onClick={() => setPieces((p) => Math.min(100, p + 1))} aria-label="Una pieza más">
          +
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="destructive" className="h-11" disabled={pending !== null} onClick={() => send("reject")}>
          {pending === "reject" ? "Rechazando…" : "Rechazar"}
        </Button>
        <Button className="h-11" disabled={pending !== null} onClick={() => send("approve")}>
          {pending === "approve" ? "Confirmando…" : `Confirmar ${pieces}`}
        </Button>
      </div>
    </div>
  );
}
