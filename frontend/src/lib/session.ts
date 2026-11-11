import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CurrentUserResponse } from "@dra/contracts";

export const getCurrentUser = cache(async () => {
  const cookie = (await cookies()).toString();
  if (!cookie) return null;
  const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/me`, {
    headers: { cookie }, cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Não foi possível verificar o acesso ao painel.");
  return ((await response.json()) as CurrentUserResponse).user;
});

export async function requireUser(admin = false) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (admin && user.role !== "admin") redirect("/respostas");
  return user;
}
