import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { assertIsolatedTestDatabase, loadTestDatabaseEnvironment } from "./test-database";

async function main() {
  const { testDatabaseUrl, applicationDatabaseUrl } = loadTestDatabaseEnvironment();
  if (!testDatabaseUrl) {
    throw new Error("Falta TEST_DATABASE_URL. Configura una base Neon vacía e independiente antes de migrarla.");
  }

  await assertIsolatedTestDatabase(testDatabaseUrl, applicationDatabaseUrl);

  const pool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
    console.log("Migraciones aplicadas a la base aislada de pruebas.");
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof Error && error.message.startsWith("Falta TEST_DATABASE_URL.")) {
    console.error(error.message);
  } else {
    console.error("No se pudieron aplicar las migraciones a la base aislada de pruebas. Revisa su configuración y disponibilidad.");
  }
  process.exitCode = 1;
});
