import test from "node:test";
import assert from "node:assert/strict";
import { buildContentSecurityPolicy } from "../src/lib/csp";

test("CSP permite eval solo durante el desarrollo", () => {
  assert.match(buildContentSecurityPolicy(true), /script-src[^;]*'unsafe-eval'/);
  assert.doesNotMatch(buildContentSecurityPolicy(false), /script-src[^;]*'unsafe-eval'/);
});
