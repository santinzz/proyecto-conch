import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Escanear" };

// Fuera del grupo (cliente) a propósito: si no hay sesión, el login debe
// regresar aquí con el ticket (?t=…), y solo la página conoce los searchParams.
export default async function EscanearPage({ searchParams }: PageProps<"/escanear">) {
  const t = (await searchParams).t;
  const token = typeof t === "string" ? t : undefined;
  const user = await requireUser(undefined, {
    returnTo: token ? `/escanear?t=${encodeURIComponent(token)}` : "/escanear",
  });

  return (
    <AppShell user={user}>
      <Scanner initialToken={token} />
    </AppShell>
  );
}
