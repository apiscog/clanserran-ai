import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { account, user } from "../src/db/schema";
import { createAuthForDatabase } from "../src/lib/auth-config";
import { getServerEnv } from "../src/lib/env";
import { INTERNAL_SIGNUP_HEADER, internalSignupMarkerForSecret } from "../src/lib/internal-signup-marker";
import {
  assertIsolatedTestDatabase,
  assertTestSchemaIsMigrated,
  loadTestDatabaseEnvironment,
} from "../scripts/test-database";

const { testDatabaseUrl, applicationDatabaseUrl } = loadTestDatabaseEnvironment();

test("el acceso sin correo crea y autentica una credencial real sin abrir el alta pública", { skip: !testDatabaseUrl }, async () => {
  await assertIsolatedTestDatabase(testDatabaseUrl!, applicationDatabaseUrl);
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 2 });
  const db = drizzle({ client: pool, schema });
  const runId = randomUUID();
  const username = `u${runId.replaceAll("-", "").slice(0, 20)}`;
  const email = `${runId}@users.invalid`;
  let createdUserId: string | undefined;

  try {
    await assertTestSchemaIsMigrated(pool);
    const env = getServerEnv();
    const auth = createAuthForDatabase(db, env);
    const endpoint = `${env.BETTER_AUTH_URL}/api/auth/sign-up/email`;
    const body = JSON.stringify({ name: `Usuario local ${runId}`, username, email, password: "Aa1x" });

    const rejected = await auth.handler(new Request(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
      body,
    }));
    assert.equal(rejected.status, 403);

    const registered = await auth.handler(new Request(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: env.BETTER_AUTH_URL,
        [INTERNAL_SIGNUP_HEADER]: internalSignupMarkerForSecret(env.BETTER_AUTH_SECRET),
      },
      body,
    }));
    assert.equal(registered.status, 200);
    const registration = await registered.json() as { user: { id: string; username?: string } };
    createdUserId = registration.user.id;
    assert.equal(registration.user.username, username);

    const [credential] = await db
      .select({ accountId: account.accountId, password: account.password })
      .from(account)
      .where(and(eq(account.userId, createdUserId), eq(account.providerId, "credential")))
      .limit(1);
    assert.equal(credential?.accountId, createdUserId);
    assert.ok(credential?.password);
    assert.notEqual(credential.password, "Aa1x");

    const signedIn = await auth.handler(new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/username`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
      body: JSON.stringify({ username, password: "Aa1x" }),
    }));
    assert.equal(signedIn.status, 200);
    assert.match(signedIn.headers.get("set-cookie") ?? "", /clan-serran\.session_token=/);
  } finally {
    try {
      if (createdUserId) await db.delete(user).where(eq(user.id, createdUserId));
    } finally {
      await pool.end();
    }
  }
});
