import Link from "next/link";
import { AppNav, type NavLink } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import type { SessionUser } from "@/lib/auth/session";

/** Solo se muestra el rol del equipo; un cliente no necesita verlo. */
const ROLE_LABEL = { CUSTOMER: null, OPERATOR: "Operador", ADMIN: "Admin" } as const;

export function AppHeader({ user }: { user: SessionUser }) {
  const links: NavLink[] = [
    { href: "/", label: "Inicio" },
    { href: "/recibos", label: "Recibos" },
    { href: "/retos", label: "Retos" },
    { href: "/canjear", label: "Canjear" },
    { href: "/mi-impacto", label: "Mi impacto" },
  ];
  if (user.role === "OPERATOR" || user.role === "ADMIN") links.push({ href: "/operador", label: "Operador" });
  if (user.role === "ADMIN") links.push({ href: "/admin", label: "Admin" });
  const role = ROLE_LABEL[user.role];

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-3">
        <Link href="/" className="shrink-0 font-heading text-xl font-extrabold tracking-tight text-primary">
          EcoPuntos
        </Link>
        <div className="flex min-w-0 items-center gap-1 text-sm">
          <span className="truncate text-muted-foreground">
            {user.name.split(" ")[0]}
            {role && <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-foreground">{role}</span>}
          </span>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm" className="h-11">
              Salir
            </Button>
          </form>
        </div>
      </div>
      <AppNav links={links} />
    </header>
  );
}
