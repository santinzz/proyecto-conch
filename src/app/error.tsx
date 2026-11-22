"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        No pudimos cargar esta pantalla. Revisa tu conexión e intenta de nuevo.
        {error.digest && <span className="mt-1 block font-mono text-xs">Código: {error.digest}</span>}
      </p>
      <div className="flex gap-2">
        <Button className="h-11" onClick={() => retry()}>
          Intentar de nuevo
        </Button>
        <Button nativeButton={false} variant="outline" className="h-11" render={<Link href="/" />}>
          Ir al inicio
        </Button>
      </div>
    </main>
  );
}
