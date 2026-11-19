import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sin permiso" };

export default function SinPermisoPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl">🚫</p>
      <h1 className="text-xl font-semibold">No tienes permiso para ver esta sección</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Si crees que es un error, pide a un administrador que revise tu rol.
      </p>
      <Button nativeButton={false} render={<Link href="/" />}>Volver al inicio</Button>
    </main>
  );
}
