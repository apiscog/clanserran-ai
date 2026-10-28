import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import type { Database } from "@/db";
import { schema } from "@/db/schema";
import { generateAuthId } from "@/lib/auth-id";
import type { ServerEnv } from "@/lib/env";
import { INTERNAL_SIGNUP_HEADER, validInternalSignupMarkerForSecret } from "@/lib/internal-signup-marker";
import { normalizeUsername, passwordSchema, usernameSchema } from "@/lib/local-access";

export function createAuthForDatabase(db: Database, env: ServerEnv) {
  const authOrigin = new URL(env.BETTER_AUTH_URL);
  return betterAuth({
    appName: "Clan Serran",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 4,
      maxPasswordLength: 128,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" },
      microsoft: {
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        tenantId: "consumers",
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    trustedOrigins: [env.BETTER_AUTH_URL],
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/username": { window: 15 * 60, max: 5 },
        "/sign-in/passkey": { window: 60, max: 10 },
      },
    },
    logger: {
      level: "error",
      log: (level) => console.error(`[Better Auth] ${level}: error de autenticación`),
    },
    advanced: {
      cookiePrefix: "clan-serran",
      useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
      database: { generateId: generateAuthId },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== "/sign-up/email") return;
        if (!validInternalSignupMarkerForSecret(context.headers?.get(INTERNAL_SIGNUP_HEADER) ?? null, env.BETTER_AUTH_SECRET)) {
          throw new APIError("FORBIDDEN", { message: "El alta sin correo requiere una invitación válida." });
        }
        const body = context.body as { username?: unknown; password?: unknown } | undefined;
        if (!body || !usernameSchema.safeParse(body.username).success || !passwordSchema.safeParse(body.password).success) {
          throw new APIError("BAD_REQUEST", { message: "Los datos del acceso sin correo no son válidos." });
        }
      }),
    },
    plugins: [
      username({
        minUsernameLength: 4,
        maxUsernameLength: 24,
        displayUsername: false,
        immutableUsername: true,
        usernameNormalization: normalizeUsername,
        usernameValidator: (value) => usernameSchema.safeParse(value).success,
      }),
      passkey({ rpID: authOrigin.hostname, rpName: "Clan Serran", origin: env.BETTER_AUTH_URL }),
    ],
  });
}
