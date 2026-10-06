"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOut() {
  const router = useRouter();
  return (
    <button className="button secondary" type="button" onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/") } })}>
      <LogOut aria-hidden="true" size={19} /> Salir
    </button>
  );
}
