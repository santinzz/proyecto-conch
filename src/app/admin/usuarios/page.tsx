import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AdminPageHeader } from "../admin-page";
import { UserRow } from "./user-row";

export const metadata: Metadata = { title: "Usuarios" };

const dayFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

export default async function UsuariosPage() {
  const admin = await requireUser(AREA_ROLES.admin);
  const [users, balances] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    db.pointEntry.groupBy({ by: ["userId"], _sum: { points: true } }),
  ]);
  const balanceOf = (id: string) => balances.find((b) => b.userId === id)?._sum.points ?? 0;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Usuarios"
        description="Haz operadoras a las personas del equipo que atienden el stand. Los ajustes de puntos quedan registrados con su motivo."
      />
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id}>
            <UserRow
              user={{
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                balance: balanceOf(u.id),
                joined: dayFmt.format(u.createdAt),
                isSelf: u.id === admin.id,
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
