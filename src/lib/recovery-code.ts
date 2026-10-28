import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { normalizeRecoveryCode } from "@/lib/local-access";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode() {
  const bytes = randomBytes(16);
  let compact = "";
  for (let index = 0; index < 16; index += 1) compact += alphabet[bytes[index]! % alphabet.length];
  return compact.match(/.{1,4}/g)!.join("-");
}

export function hashRecoveryCode(code: string) {
  return createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update(`clan-serran-recovery:${normalizeRecoveryCode(code)}`)
    .digest("hex");
}

export function recoveryCodeMatches(code: string, expectedHash: string) {
  const actual = Buffer.from(hashRecoveryCode(code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
