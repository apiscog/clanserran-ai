import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb } from "@/db";
import { account, recoveryCodes, session, user } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { recoverySchema } from "@/lib/local-access";
import { consumePersistentRateLimit, requestIp } from "@/lib/persistent-rate-limit";
import { generateRecoveryCode, hashRecoveryCode, recoveryCodeMatches } from "@/lib/recovery-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trustedOrigin(request: Request) {
  return request.headers.get("origin") === getServerEnv().BETTER_AUTH_URL && request.headers.get("sec-fetch-site") !== "cross-site";
}

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!trustedOrigin(request)) return json({ message: "La solicitud no es válida." }, 403);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ message: "Los datos enviados no son válidos." }, 400);
  }
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]));
    return json({ fields }, 400);
  }

  const db = getDb();
  const { username, recoveryCode, password } = parsed.data;
  try {
    await consumePersistentRateLimit(db, `local-recovery:${requestIp(request.headers)}:${username}`, {
      max: 5,
      windowMs: 15 * 60 * 1000,
      message: "Demasiados intentos. Espera 15 minutos antes de volver a probar.",
    });

    const passwordHash = await hashPassword(password);
    const replacementCode = generateRecoveryCode();
    const replacementHash = hashRecoveryCode(replacementCode);
    const [candidate] = await db.select({ id: user.id }).from(user).where(eq(user.username, username)).limit(1);
    if (!candidate) return json({ message: "El usuario o el código de recuperación no son correctos." }, 400);

    const updated = await db.transaction(async (tx) => {
      const [stored] = await tx
        .select({ codeHash: recoveryCodes.codeHash })
        .from(recoveryCodes)
        .where(eq(recoveryCodes.userId, candidate.id))
        .limit(1)
        .for("update");
      if (!stored || !recoveryCodeMatches(recoveryCode, stored.codeHash)) return false;

      const [credential] = await tx
        .update(account)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(and(eq(account.userId, candidate.id), eq(account.providerId, "credential")))
        .returning({ id: account.id });
      if (!credential) return false;

      await tx.delete(session).where(eq(session.userId, candidate.id));
      await tx
        .update(recoveryCodes)
        .set({ codeHash: replacementHash, updatedAt: new Date() })
        .where(eq(recoveryCodes.userId, candidate.id));
      return true;
    });

    if (!updated) return json({ message: "El usuario o el código de recuperación no son correctos." }, 400);
    return json({ recoveryCode: replacementCode }, 200);
  } catch (error) {
    if (error instanceof Error && error.name === "DomainError") return json({ message: error.message }, 429);
    console.error("No se pudo recuperar el acceso sin correo", { type: error instanceof Error ? error.name : "UnknownError" });
    return json({ message: "No hemos podido recuperar el acceso. Inténtalo de nuevo." }, 500);
  }
}
