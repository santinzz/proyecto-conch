import { AppShell } from "@/components/app-shell";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(AREA_ROLES.admin);
  return <AppShell user={user}>{children}</AppShell>;
}
