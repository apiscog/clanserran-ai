import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const current = await getSession();
  if (!current) redirect("/?acceso=necesario");
  return current.user;
}
