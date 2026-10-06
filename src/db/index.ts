import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "@/lib/env";
import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as { clanSerranPool?: Pool };

export function getPool() {
  if (!globalForDb.clanSerranPool) {
    const pool = new Pool({
      connectionString: getServerEnv().DATABASE_URL,
      max: process.env.NODE_ENV === "production" ? 5 : 2,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
    });
    if (process.env.VERCEL === "1") attachDatabasePool(pool);
    globalForDb.clanSerranPool = pool;
  }
  return globalForDb.clanSerranPool;
}

export function getDb() {
  return drizzle({ client: getPool(), schema });
}

export type Database = ReturnType<typeof getDb>;
