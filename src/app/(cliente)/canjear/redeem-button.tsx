"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPoints } from "@/lib/format";

/** Canjear en dos pasos para no gastar puntos por un toque accidental. */
export function RedeemButton({
  rewardId,
  cost,
  isDonation,
  disabledReason,
}: {
  rewardId: string;
  cost: number;
  isDonation: boolean;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function redeem() {
    setPending(true);
    setMessage(undefined);
    try {
      const res = await fetch("/api/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "No se pudo canjear" });
        return;
      }
      setMessage({
        ok: true,
        text: isDonation ? "🌳 ¡Gracias! Tu donación quedó registrada." : "🎁 ¡Listo! Tu cupón está abajo, en «Mis cupones».",
      });
      setConfirming(false);
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Sin conexión. Intenta de nuevo." });
    } finally {
      setPending(false);
    }
  }

  const label = `${isDonation ? "Donar" : "Canjear"} por ${formatPoints(cost)} puntos`;
  return (
    <div className="space-y-2">
      {disabledReason ? (
        <Button className="h-11 w-full" disabled>
          {disabledReason}
        </Button>
      ) : confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => setConfirming(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={redeem} disabled={pending}>
            {pending ? "Canjeando…" : "Sí, confirmar"}
          </Button>
        </div>
      ) : (
        <Button className="h-11 w-full" onClick={() => setConfirming(true)}>
          {label}
        </Button>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm font-medium ${message.ok ? "text-primary" : "text-destructive"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
