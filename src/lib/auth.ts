import "server-only";

import { getDb } from "@/db";
import { createAuthForDatabase } from "@/lib/auth-config";
import { getServerEnv } from "@/lib/env";

let authInstance: ReturnType<typeof createAuthForDatabase> | undefined;

export function getAuth(): ReturnType<typeof createAuthForDatabase> {
  authInstance ??= createAuthForDatabase(getDb(), getServerEnv());
  return authInstance;
}
