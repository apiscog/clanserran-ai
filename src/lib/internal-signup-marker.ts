import { createHmac, timingSafeEqual } from "node:crypto";

export const INTERNAL_SIGNUP_HEADER = "x-clan-internal-signup";

export function internalSignupMarkerForSecret(secret: string) {
  return createHmac("sha256", secret)
    .update("clan-serran:internal-local-signup:v1")
    .digest("hex");
}

export function validInternalSignupMarkerForSecret(value: string | null, secret: string) {
  if (!value) return false;
  const actual = Buffer.from(value, "hex");
  const expected = Buffer.from(internalSignupMarkerForSecret(secret), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
