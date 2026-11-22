"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { binUrl } from "@/lib/qr-token";

/** QR fijo del contenedor para imprimir y pegar. Lleva la URL de /reciclar de este sitio. */
export function BinQr({ code, name }: { code: string; name: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    QRCode.toDataURL(binUrl(window.location.origin, code), { width: 480, margin: 2 })
      .then(setSrc)
      .catch(() => setSrc(undefined));
  }, [code]);
  return (
    <div className="space-y-1 text-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen generada en el navegador (data URL)
        <img src={src} alt={`QR del contenedor ${name}`} className="mx-auto size-48" />
      ) : (
        <div className="mx-auto size-48 animate-pulse rounded bg-muted" />
      )}
      <p className="text-sm font-medium">{name}</p>
      <p className="font-mono text-xs text-muted-foreground">{code}</p>
      {src && (
        <a href={src} download={`contenedor-${code}.png`} className="text-sm text-primary underline-offset-4 hover:underline">
          Descargar para imprimir
        </a>
      )}
    </div>
  );
}
