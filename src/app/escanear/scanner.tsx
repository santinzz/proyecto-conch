"use client";

import type { Html5Qrcode } from "html5-qrcode";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPoints } from "@/lib/format";
import { normalizeCouponCode } from "@/lib/coupon-code";
import { extractBinCode, extractTicketToken } from "@/lib/qr-token";

type ClaimResult = {
  purchasePoints: number;
  levelBonus: number;
  containerPoints: number;
  containerLimitReached: boolean;
  totalPoints: number;
  challenges?: { title: string; reward: number }[];
};

type State =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "claiming" }
  | { kind: "success"; result: ClaimResult }
  | { kind: "error"; message: string };

const READER_ID = "qr-reader";

export function Scanner({ initialToken }: { initialToken?: string }) {
  const [state, setState] = useState<State>(initialToken ? { kind: "claiming" } : { kind: "idle" });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const claimedInitial = useRef(false);
  const router = useRouter();

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner?.isScanning) await scanner.stop().catch(() => {});
  }, []);

  const claim = useCallback(async (token: string) => {
    setState({ kind: "claiming" });
    try {
      const res = await fetch("/api/sales/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setState({ kind: "success", result: data });
      else setState({ kind: "error", message: data.error ?? "No se pudo canjear el ticket" });
    } catch {
      setState({ kind: "error", message: "Sin conexión. Intenta de nuevo." });
    }
  }, []);

  const handleScan = useCallback(
    async (text: string) => {
      await stopCamera();
      const binCode = extractBinCode(text);
      if (binCode) {
        router.push(`/reciclar?bin=${encodeURIComponent(binCode)}`);
        return;
      }
      if (normalizeCouponCode(text)) {
        setState({ kind: "error", message: "Ese es un cupón: muéstraselo a quien atiende el stand." });
        return;
      }
      const token = extractTicketToken(text);
      if (!token) {
        setState({ kind: "error", message: "Ese código no es un ticket de EcoPuntos" });
        return;
      }
      await claim(token);
    },
    [claim, stopCamera, router],
  );

  // Ticket que llegó en la URL (cámara normal del teléfono): se reclama una vez
  // y se quita de la URL para que recargar no lo intente de nuevo.
  useEffect(() => {
    if (!initialToken || claimedInitial.current) return;
    claimedInitial.current = true;
    window.history.replaceState(null, "", "/escanear");
    void claim(initialToken);
  }, [initialToken, claim]);

  // Abre la cámara cuando el lector ya está en pantalla.
  useEffect(() => {
    if (state.kind !== "scanning") return;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.75, height: Math.min(w, h) * 0.75 }) },
          (text) => void handleScan(text),
          undefined,
        );
      } catch {
        if (!cancelled) {
          setState({
            kind: "error",
            message: "No pudimos abrir la cámara. Revisa el permiso del navegador o usa la cámara de tu teléfono.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [state.kind, handleScan, stopCamera]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Escanear</h1>

      {state.kind === "idle" && (
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-5xl">📷</p>
            <p className="text-sm text-muted-foreground">
              Escanea el QR del ticket en la caja del stand para sumar tus puntos.
            </p>
            <Button className="h-12 w-full text-base" onClick={() => setState({ kind: "scanning" })}>
              Abrir cámara
            </Button>
          </CardContent>
        </Card>
      )}

      {state.kind === "scanning" && (
        <div className="space-y-3">
          <div id={READER_ID} className="overflow-hidden rounded-lg bg-black" />
          <p className="text-center text-sm text-muted-foreground">Apunta al código QR</p>
          <Button variant="outline" className="h-11 w-full" onClick={() => setState({ kind: "idle" })}>
            Cancelar
          </Button>
        </div>
      )}

      {state.kind === "claiming" && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="animate-pulse text-lg font-medium">Canjeando ticket…</p>
          </CardContent>
        </Card>
      )}

      {state.kind === "success" && (
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-5xl">🎉</p>
            <p className="text-4xl font-bold text-primary">+{formatPoints(state.result.totalPoints)} puntos</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {state.result.purchasePoints > 0 && (
                <li>
                  Compra: {formatPoints(state.result.purchasePoints)}
                  {state.result.levelBonus > 0 && ` (incluye +${formatPoints(state.result.levelBonus)} por tu nivel)`}
                </li>
              )}
              {state.result.containerPoints > 0 && <li>Trajiste tu envase: +{state.result.containerPoints}</li>}
              {state.result.containerLimitReached && (
                <li>♻️ Gracias por tu envase. Hoy ya sumaste puntos por envase; lo contamos para el impacto.</li>
              )}
              {state.result.challenges?.map((c) => (
                <li key={c.title} className="font-medium text-primary">
                  🏆 ¡Completaste «{c.title}»! +{formatPoints(c.reward)}
                </li>
              ))}
            </ul>
            <Button nativeButton={false} className="h-12 w-full text-base" render={<Link href="/" />}>
              Ver mi saldo
            </Button>
          </CardContent>
        </Card>
      )}

      {state.kind === "error" && (
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-5xl">⚠️</p>
            <p role="alert" className="text-lg font-medium">
              {state.message}
            </p>
            <Button className="h-12 w-full text-base" onClick={() => setState({ kind: "scanning" })}>
              Escanear otra vez
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
