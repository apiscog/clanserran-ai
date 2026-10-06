import test from "node:test";
import assert from "node:assert/strict";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import * as schema from "../src/db/schema";
import { verification } from "../src/db/schema";
import { generateAuthId } from "../src/lib/auth-id";
import {
  assertIsolatedTestDatabase,
  assertTestSchemaIsMigrated,
  loadTestDatabaseEnvironment,
} from "../scripts/test-database";

const { testDatabaseUrl, applicationDatabaseUrl } = loadTestDatabaseEnvironment();

test("el adaptador Drizzle guarda estados OAuth con UUID y callbacks oficiales", { skip: !testDatabaseUrl }, async () => {
  await assertIsolatedTestDatabase(testDatabaseUrl!, applicationDatabaseUrl);
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 2 });
  const db = drizzle({ client: pool, schema });
  let baselineIds: Set<string> | undefined;

  try {
    await assertTestSchemaIsMigrated(pool);
    baselineIds = new Set((await db.select({ id: verification.id }).from(verification)).map((row) => row.id));
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      secret: "regression-test-secret-at-least-32-bytes",
      database: drizzleAdapter(db, { provider: "pg", schema }),
      socialProviders: {
        google: { clientId: "test-google-client", clientSecret: "test-google-secret" },
        microsoft: { clientId: "test-microsoft-client", clientSecret: "test-microsoft-secret", tenantId: "consumers" },
      },
      trustedOrigins: ["http://localhost:3000"],
      logger: { disabled: true },
      advanced: { database: { generateId: generateAuthId } },
    });

    for (const provider of ["google", "microsoft"] as const) {
      const response = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ provider, callbackURL: "/inicio", disableRedirect: true }),
      }));

      assert.ok(response.status >= 200 && response.status < 400, `El inicio con ${provider} no debe devolver error.`);
      const payload = await response.json() as { url?: string };
      assert.ok(payload.url, `El inicio con ${provider} debe generar una URL OAuth.`);
      const authorizationUrl = new URL(payload.url);
      assert.equal(authorizationUrl.searchParams.get("redirect_uri"), `http://localhost:3000/api/auth/callback/${provider}`);
      if (provider === "microsoft") assert.equal(authorizationUrl.pathname, "/consumers/oauth2/v2.0/authorize");
    }

    const after = await db.select({ id: verification.id }).from(verification);
    const createdIds = after.map((row) => row.id).filter((id) => !baselineIds!.has(id));
    assert.equal(createdIds.length, 2);
    for (const id of createdIds) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  } finally {
    try {
      if (baselineIds) {
        const currentIds = (await db.select({ id: verification.id }).from(verification)).map((row) => row.id);
        const createdIds = currentIds.filter((id) => !baselineIds!.has(id));
        if (createdIds.length > 0) await db.delete(verification).where(inArray(verification.id, createdIds));
      }
    } finally {
      await pool.end();
    }
  }
});
