import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-5xl">🍃</p>
      <h1 className="text-xl font-semibold">No encontramos esta página</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Puede que el enlace esté mal escrito o que ya no exista.</p>
      <Button nativeButton={false} className="h-11" render={<Link href="/" />}>
        Volver al inicio
      </Button>
    </main>
  );
}
