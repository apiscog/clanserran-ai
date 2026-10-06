import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

export type TestDatabaseEnvironment = {
  testDatabaseUrl?: string;
  applicationDatabaseUrl?: string;
};

export function loadTestDatabaseEnvironment(): TestDatabaseEnvironment {
  loadEnvConfig(process.cwd());
  return {
    testDatabaseUrl: process.env.TEST_DATABASE_URL,
    applicationDatabaseUrl: process.env.DATABASE_URL,
  };
}

function parsePostgresUrl(value: string, variable: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} no es una URL PostgreSQL válida.`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`${variable} debe usar el protocolo PostgreSQL.`);
  }
  return url;
}

function normalizedHost(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (hostname.endsWith(".neon.tech")) {
    const [endpoint, ...rest] = hostname.split(".");
    return [endpoint!.replace(/-pooler$/, ""), ...rest].join(".");
  }
  return hostname;
}

function databaseFromPath(url: URL) {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

async function inspectConnection(connectionString: string) {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query<{ database_name: string; read_only: boolean }>(
      "select current_database() as database_name, current_setting('transaction_read_only')::boolean as read_only",
    );
    return result.rows[0]!;
  } finally {
    await pool.end();
  }
}

export async function assertIsolatedTestDatabase(testDatabaseUrl: string, applicationDatabaseUrl?: string) {
  if (!applicationDatabaseUrl) {
    throw new Error("No se puede garantizar el aislamiento: falta DATABASE_URL para compararla con TEST_DATABASE_URL.");
  }

  const testUrl = parsePostgresUrl(testDatabaseUrl, "TEST_DATABASE_URL");
  const applicationUrl = parsePostgresUrl(applicationDatabaseUrl, "DATABASE_URL");
  const testHost = normalizedHost(testUrl);
  const applicationHost = normalizedHost(applicationUrl);
  const testIsNeon = testHost.endsWith(".neon.tech");
  const applicationIsNeon = applicationHost.endsWith(".neon.tech");

  const [testConnection, applicationConnection] = await Promise.all([
    inspectConnection(testDatabaseUrl),
    inspectConnection(applicationDatabaseUrl),
  ]);

  if (testHost === applicationHost && testConnection.database_name === applicationConnection.database_name) {
    throw new Error("TEST_DATABASE_URL y DATABASE_URL apuntan a la misma base, aunque usen otro usuario, parámetros o conexión pooled/directa.");
  }

  if (testHost === applicationHost && testConnection.database_name !== applicationConnection.database_name) {
    return;
  }

  if (testIsNeon && applicationIsNeon) {
    if (testConnection.read_only || applicationConnection.read_only) {
      throw new Error("No se puede garantizar el aislamiento con un endpoint Neon de solo lectura. Usa dos ramas primarias distintas.");
    }
    return;
  }

  const requestedTestDatabase = databaseFromPath(testUrl);
  const requestedApplicationDatabase = databaseFromPath(applicationUrl);
  if (testUrl.hostname.toLowerCase() === applicationUrl.hostname.toLowerCase()
      && (testUrl.port || "5432") === (applicationUrl.port || "5432")
      && requestedTestDatabase !== requestedApplicationDatabase
      && testConnection.database_name !== applicationConnection.database_name) {
    return;
  }

  throw new Error("No se puede garantizar que TEST_DATABASE_URL esté aislada de DATABASE_URL. Usa una base o rama Neon independiente.");
}

export async function assertTestSchemaIsMigrated(pool: Pool) {
  const result = await pool.query<{ present: string | null }>("select to_regclass('public.groups')::text as present");
  if (!result.rows[0]?.present) {
    throw new Error("La base de pruebas no tiene las migraciones. Ejecuta: npm.cmd run db:migrate:test");
  }
}
