import { AppShell } from "@/components/app-shell";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";

export default async function OperadorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(AREA_ROLES.operador);
  return <AppShell user={user}>{children}</AppShell>;
}
