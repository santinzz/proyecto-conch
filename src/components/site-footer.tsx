import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-2xl flex-wrap justify-center gap-x-4 px-4 pb-6 text-xs text-muted-foreground">
      <Link href="/privacidad" className="inline-flex min-h-11 items-center hover:underline">
        Aviso de privacidad
      </Link>
      <Link href="/impacto" className="inline-flex min-h-11 items-center hover:underline">
        Impacto del piloto
      </Link>
    </footer>
  );
}
