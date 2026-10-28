import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groups, recoveryCodes, user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { INTERNAL_SIGNUP_HEADER, internalSignupMarker } from "@/lib/internal-signup";
import { localRegistrationSchema } from "@/lib/local-access";
import { consumePersistentRateLimit, requestIp } from "@/lib/persistent-rate-limit";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === getServerEnv().BETTER_AUTH_URL && request.headers.get("sec-fetch-site") !== "cross-site";
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]));
}

function json(body: object, status = 200, headers?: HeadersInit) {
  const response = Response.json(body, { status });
  response.headers.set("cache-control", "no-store");
  if (headers) {
    const source = new Headers(headers);
    source.forEach((value, key) => {
      if (key !== "set-cookie") response.headers.set(key, value);
    });
    const cookies = (source as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  }
  return response;
}

export async function POST(request: Request) {
  if (!trustedOrigin(request)) return json({ message: "La solicitud no es válida." }, 403);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ message: "Los datos enviados no son válidos." }, 400);
  }

  const parsed = localRegistrationSchema.safeParse(input);
  if (!parsed.success) return json({ fields: fieldErrors(parsed.error.issues) }, 400);

  const db = getDb();
  const { inviteToken, name, username, password } = parsed.data;
  try {
    await consumePersistentRateLimit(db, `local-register:${requestIp(request.headers)}:${inviteToken}`, {
      max: 5,
      windowMs: 15 * 60 * 1000,
      message: "Demasiados intentos. Espera 15 minutos antes de volver a probar.",
    });

    const [invitedGroup] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.inviteToken, inviteToken))
      .limit(1);
    if (!invitedGroup) return json({ message: "La invitación no es válida." }, 400);
    const [openGroup] = await db
      .select({ status: groups.status })
      .from(groups)
      .where(eq(groups.id, invitedGroup.id))
      .limit(1);
    if (openGroup?.status !== "open") return json({ message: "Las inscripciones de esta invitación ya están cerradas." }, 400);

    const recoveryCode = generateRecoveryCode();
    const syntheticEmail = `${randomUUID()}@users.invalid`;
    const authHeaders = new Headers(request.headers);
    authHeaders.set(INTERNAL_SIGNUP_HEADER, internalSignupMarker());

    const authResponse = await getAuth().api.signUpEmail({
      body: { name, username, email: syntheticEmail, password, rememberMe: true },
      headers: authHeaders,
      asResponse: true,
    });

    if (!authResponse.ok) {
      const payload = await authResponse.clone().json().catch(() => null) as { code?: string } | null;
      if (payload?.code?.includes("USERNAME")) {
        return json({ fields: { username: "Ese usuario ya está utilizado. Prueba con otro." } }, 409);
      }
      return json({ message: "No hemos podido crear el acceso. Revisa los datos e inténtalo de nuevo." }, 400);
    }

    const payload = await authResponse.clone().json() as { user: { id: string } };
    try {
      await db.transaction(async (tx) => {
        await tx.insert(recoveryCodes).values({ userId: payload.user.id, codeHash: hashRecoveryCode(recoveryCode) });
        await tx.update(user).set({ displayNameConfirmed: true, updatedAt: new Date() }).where(eq(user.id, payload.user.id));
      });
    } catch (error) {
      await db.delete(user).where(eq(user.id, payload.user.id));
      throw error;
    }

    const responseHeaders = new Headers({ "cache-control": "no-store" });
    const setCookies = (authResponse.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const cookie of setCookies) responseHeaders.append("set-cookie", cookie);

    return json({ recoveryCode, next: `/invitacion/${inviteToken}` }, 201, responseHeaders);
  } catch (error) {
    if (error instanceof Error && error.name === "DomainError") return json({ message: error.message }, 429);
    console.error("No se pudo crear el acceso sin correo", { type: error instanceof Error ? error.name : "UnknownError" });
    return json({ message: "No hemos podido crear el acceso. Inténtalo de nuevo." }, 500);
  }
}
