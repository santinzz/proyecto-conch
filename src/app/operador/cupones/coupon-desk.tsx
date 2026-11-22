"use client";

import { useCallback, useState } from "react";
import { QrReader } from "@/components/qr-reader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeCouponCode } from "@/lib/coupon-code";

type Coupon = {
  code: string;
  reward: string;
  isDonation: boolean;
  customer: string;
  usedAt: string | null;
  usedBy: string | null;
};

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export function CouponDesk() {
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const lookup = useCallback(async (raw: string) => {
    setError(undefined);
    setDone(undefined);
    setCoupon(null);
    const code = normalizeCouponCode(raw);
    if (!code) {
      setError("Eso no parece un cupón de EcoPuntos (ECO-XXXX-XXXX)");
      return;
    }
    setInput(code);
    setPending(true);
    try {
      const res = await fetch(`/api/redemptions/${encodeURIComponent(code)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "No se encontró el cupón");
      else setCoupon(data);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }, []);

  const onScan = useCallback(
    (text: string) => {
      setScanning(false);
      void lookup(text);
    },
    [lookup],
  );
  const onCameraError = useCallback((message: string) => {
    setScanning(false);
    setError(message);
  }, []);

  async function markUsed() {
    if (!coupon) return;
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/redemptions/${encodeURIComponent(coupon.code)}/use`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo marcar el cupón");
        return;
      }
      setDone(`✅ Entrega «${data.reward}» a ${data.customer.split(" ")[0]}.`);
      setCoupon(null);
      setInput("");
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {scanning ? (
        <div className="space-y-2">
          <QrReader onScan={onScan} onError={onCameraError} />
          <Button variant="outline" className="h-11 w-full" onClick={() => setScanning(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-3">
            <Button className="h-12 w-full text-base" onClick={() => setScanning(true)}>
              📷 Escanear cupón
            </Button>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void lookup(input);
              }}
            >
              <Label htmlFor="coupon-code">O escribe el código</Label>
              <div className="flex gap-2">
                <Input
                  id="coupon-code"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ECO-XXXX-XXXX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="h-11 font-mono uppercase"
                />
                <Button type="submit" variant="outline" className="h-11" disabled={pending || !input.trim()}>
                  Buscar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-primary/10 p-3 font-medium text-primary">
          {done}
        </p>
      )}

      {coupon && (
        <Card>
          <CardContent className="space-y-3">
            <div>
              <p className="font-mono text-sm text-muted-foreground">{coupon.code}</p>
              <p className="text-lg font-semibold">{coupon.reward}</p>
              <p className="text-sm text-muted-foreground">De {coupon.customer}</p>
            </div>
            {coupon.isDonation ? (
              <p className="text-sm">Es una donación a árboles: no hay nada que entregar.</p>
            ) : coupon.usedAt ? (
              <p className="text-sm font-medium text-destructive">
                Ya se usó el {dateFmt.format(new Date(coupon.usedAt))}
                {coupon.usedBy && ` (lo marcó ${coupon.usedBy})`}. No lo entregues otra vez.
              </p>
            ) : (
              <Button className="h-12 w-full text-base" onClick={markUsed} disabled={pending}>
                {pending ? "Marcando…" : "Entregar y marcar como usado"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
