import Link from "next/link";
import { auth } from "@/auth";

/** Encabezado de las páginas públicas: lleva a "Entrar" o, con sesión, a la cuenta. */
export async function PublicHeader() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
        <Link href="/" className="font-bold text-primary">
          🌱 EcoPuntos
        </Link>
        <Link
          href={signedIn ? "/" : "/login"}
          className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:underline"
        >
          {signedIn ? "Mi cuenta" : "Entrar"}
        </Link>
      </div>
    </header>
  );
}
