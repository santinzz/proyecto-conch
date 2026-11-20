import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, safeReturnTo } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeReturnTo((await searchParams).next) ?? undefined;
  if (await getSessionUser()) redirect(next ?? "/");
  return <LoginForm next={next} />;
}
