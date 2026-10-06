import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  assertIsolatedTestDatabase,
  assertTestSchemaIsMigrated,
  loadTestDatabaseEnvironment,
} from "../scripts/test-database";

const { testDatabaseUrl, applicationDatabaseUrl } = loadTestDatabaseEnvironment();

test("PostgreSQL serializa dos sorteos concurrentes con el mismo bloqueo", { skip: !testDatabaseUrl }, async () => {
  await assertIsolatedTestDatabase(testDatabaseUrl!, applicationDatabaseUrl);
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 2 });
  await assertTestSchemaIsMigrated(pool);
  const first = await pool.connect();
  const second = await pool.connect();
  const events: string[] = [];
  try {
    await first.query("begin");
    await first.query("select pg_advisory_xact_lock(hashtext($1))", ["grupo-prueba-concurrencia"]);
    events.push("primero-bloqueado");

    const competing = (async () => {
      await second.query("begin");
      await second.query("select pg_advisory_xact_lock(hashtext($1))", ["grupo-prueba-concurrencia"]);
      events.push("segundo-bloqueado");
      await second.query("rollback");
    })();

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(events, ["primero-bloqueado"]);
    await first.query("commit");
    await competing;
    assert.deepEqual(events, ["primero-bloqueado", "segundo-bloqueado"]);
  } finally {
    first.release();
    second.release();
    await pool.end();
  }
});
