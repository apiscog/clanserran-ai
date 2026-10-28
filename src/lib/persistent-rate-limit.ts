import "server-only";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { codeLookupLimits } from "@/db/schema";
import { DomainError } from "@/lib/domain";

export function requestIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

export async function consumePersistentRateLimit(
  db: Database,
  rawKey: string,
  options: { max: number; windowMs: number; message: string },
) {
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const now = new Date();
  const windowStart = new Date(now.getTime() - options.windowMs);

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${keyHash}))`);
    const [current] = await tx.select().from(codeLookupLimits).where(eq(codeLookupLimits.keyHash, keyHash)).limit(1);
    if (!current || current.windowStartedAt < windowStart) {
      await tx
        .insert(codeLookupLimits)
        .values({ keyHash, windowStartedAt: now, attempts: 1 })
        .onConflictDoUpdate({ target: codeLookupLimits.keyHash, set: { windowStartedAt: now, attempts: 1 } });
      return;
    }
    if (current.attempts >= options.max) throw new DomainError(options.message, "RATE_LIMITED");
    await tx.update(codeLookupLimits).set({ attempts: current.attempts + 1 }).where(eq(codeLookupLimits.keyHash, keyHash));
  });
}
