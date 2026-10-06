import { randomUUID } from "node:crypto";

/**
 * Better Auth must always send an explicit ID to PostgreSQL. The auth tables
 * use text primary keys, so UUID strings preserve the existing schema and FKs.
 */
export function generateAuthId() {
  return randomUUID();
}
