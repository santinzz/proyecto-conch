"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { couponQrContent } from "@/lib/coupon-code";

export function CouponQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    QRCode.toDataURL(couponQrContent(code), { width: 360, margin: 1 }).then(setSrc).catch(() => setSrc(undefined));
  }, [code]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- imagen generada en el navegador (data URL)
    <img src={src} alt={`QR del cupón ${code}`} className="mx-auto size-44" />
  ) : (
    <div className="mx-auto size-44 animate-pulse rounded bg-muted" />
  );
}
