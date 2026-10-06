import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb } from "@/db";
import { schema } from "@/db/schema";
import { generateAuthId } from "@/lib/auth-id";
import { getServerEnv } from "@/lib/env";

function createAuth() {
  const env = getServerEnv();
  return betterAuth({
      appName: "Clan Serran",
      baseURL: env.BETTER_AUTH_URL,
      secret: env.BETTER_AUTH_SECRET,
      database: drizzleAdapter(getDb(), { provider: "pg", schema }),
      socialProviders: {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          prompt: "select_account",
        },
      },
      session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
      trustedOrigins: [env.BETTER_AUTH_URL],
      logger: {
        level: "error",
        log: (level) => console.error(`[Better Auth] ${level}: error de autenticación`),
      },
      advanced: {
        cookiePrefix: "clan-serran",
        useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
        database: { generateId: generateAuthId },
      },
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  authInstance ??= createAuth();
  return authInstance;
}
