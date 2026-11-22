"use client";

import { useEffect } from "react";

/** Registra /sw.js solo en producción: en desarrollo un service worker estorba la recarga en caliente. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
