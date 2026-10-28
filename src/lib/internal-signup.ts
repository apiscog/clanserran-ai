import "server-only";

import { getServerEnv } from "@/lib/env";
import {
  INTERNAL_SIGNUP_HEADER,
  internalSignupMarkerForSecret,
  validInternalSignupMarkerForSecret,
} from "@/lib/internal-signup-marker";

export { INTERNAL_SIGNUP_HEADER };

export function internalSignupMarker() {
  return internalSignupMarkerForSecret(getServerEnv().BETTER_AUTH_SECRET);
}

export function validInternalSignupMarker(value: string | null) {
  return validInternalSignupMarkerForSecret(value, getServerEnv().BETTER_AUTH_SECRET);
}
