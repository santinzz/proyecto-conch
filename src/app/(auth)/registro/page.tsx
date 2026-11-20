import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, safeReturnTo } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const next = safeReturnTo((await searchParams).next) ?? undefined;
  if (await getSessionUser()) redirect(next ?? "/");
  return <RegisterForm next={next} />;
}
