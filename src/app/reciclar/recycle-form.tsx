"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const MAX = 100;

export function RecycleForm({ binCode }: { binCode: string }) {
  const router = useRouter();
  const [pieces, setPieces] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<number | null>(null);

  const change = (delta: number) => setPieces((p) => Math.max(1, Math.min(MAX, p + delta)));

  async function send() {
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch("/api/recycle/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binCode, pieces }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo registrar");
        return;
      }
      setSent(pieces);
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  if (sent !== null) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-4xl">🎉</p>
        <p className="font-medium">
          Registramos {sent} {sent === 1 ? "pieza" : "piezas"}.
        </p>
        <p className="text-sm text-muted-foreground">
          Alguien del equipo las va a confirmar y entonces se suman tus puntos (5 por pieza, hasta 20 piezas por semana).
        </p>
        <Button variant="outline" className="h-11 w-full" onClick={() => setSent(null)}>
          Registrar más piezas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">¿Cuántas piezas dejaste en el contenedor?</p>
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" className="size-12 text-2xl" onClick={() => change(-1)} aria-label="Una pieza menos">
          −
        </Button>
        <span className="w-16 text-center text-4xl font-bold tabular-nums" aria-live="polite">
          {pieces}
        </span>
        <Button variant="outline" className="size-12 text-2xl" onClick={() => change(1)} aria-label="Una pieza más">
          +
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button className="h-12 w-full text-base" onClick={send} disabled={pending}>
        {pending ? "Enviando…" : `Registrar ${pieces} ${pieces === 1 ? "pieza" : "piezas"}`}
      </Button>
    </div>
  );
}
