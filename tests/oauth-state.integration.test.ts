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

test("el adaptador Drizzle guarda el estado OAuth con un UUID explícito", { skip: !testDatabaseUrl }, async () => {
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
      socialProviders: { google: { clientId: "test-client", clientSecret: "test-secret" } },
      trustedOrigins: ["http://localhost:3000"],
      logger: { disabled: true },
      advanced: { database: { generateId: generateAuthId } },
    });

    const response = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ provider: "google", callbackURL: "/inicio" }),
    }));

    const after = await db.select({ id: verification.id }).from(verification);
    const createdIds = after.map((row) => row.id).filter((id) => !baselineIds!.has(id));
    assert.ok(response.status >= 200 && response.status < 400, "La creación del estado OAuth debe completarse sin error 500.");
    assert.equal(createdIds.length, 1);
    assert.match(createdIds[0]!, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
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
