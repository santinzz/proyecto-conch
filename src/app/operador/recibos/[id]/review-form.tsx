"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ReviewForm({ billId }: { billId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string>();

  async function send(action: "approve" | "reject") {
    setError(undefined);
    if (action === "reject" && note.trim().length < 3) {
      setError("Escribe el motivo del rechazo para que el cliente sepa qué corregir");
      return;
    }
    setPending(action);
    try {
      const res = await fetch(`/api/bills/${billId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la revisión");
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
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="review-note">Motivo (obligatorio para rechazar)</Label>
        <textarea
          id="review-note"
          rows={3}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej.: el consumo no coincide con la foto"
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="destructive" className="h-12" disabled={pending !== null} onClick={() => send("reject")}>
          {pending === "reject" ? "Rechazando…" : "Rechazar"}
        </Button>
        <Button className="h-12" disabled={pending !== null} onClick={() => send("approve")}>
          {pending === "approve" ? "Aprobando…" : "Aprobar"}
        </Button>
      </div>
    </div>
  );
}
