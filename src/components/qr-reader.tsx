"use client";

import type { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

const READER_ID = "qr-reader-generic";

/**
 * Lector de QR con la cámara trasera. Llama a `onScan` una vez y se apaga.
 * Necesita HTTPS (o localhost) para que el navegador dé acceso a la cámara.
 */
export function QrReader({ onScan, onError }: { onScan: (text: string) => void; onError: (message: string) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let done = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.75, height: Math.min(w, h) * 0.75 }) },
          (text) => {
            if (done) return;
            done = true;
            void scanner.stop().catch(() => {});
            onScan(text);
          },
          undefined,
        );
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) onError("No pudimos abrir la cámara. Revisa el permiso del navegador o escribe el código.");
      }
    })();
    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) void scanner.stop().catch(() => {});
    };
  }, [onScan, onError]);

  return (
    <div className="space-y-2">
      <div id={READER_ID} className="overflow-hidden rounded-lg bg-black" />
      {!ready && <p className="text-center text-sm text-muted-foreground">Abriendo cámara…</p>}
    </div>
  );
}
