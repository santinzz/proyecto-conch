"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Borrar en dos pasos (sin ventanas emergentes del navegador). */
export function DeleteBillButton({ billId }: { billId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/bills/${billId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo borrar");
        return;
      }
      router.push("/recibos");
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => setConfirming(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" className="h-11" onClick={remove} disabled={pending}>
            {pending ? "Borrando…" : "Sí, borrar"}
          </Button>
        </div>
      ) : (
        <Button variant="ghost" className="h-11 w-full text-destructive" onClick={() => setConfirming(true)}>
          Borrar este recibo
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
