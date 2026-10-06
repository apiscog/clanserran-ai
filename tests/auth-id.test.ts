import test from "node:test";
import assert from "node:assert/strict";
import { generateAuthId } from "../src/lib/auth-id";

test("el generador de autenticación produce UUID v4 válidos y distintos", () => {
  const first = generateAuthId();
  const second = generateAuthId();
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  assert.match(first, uuidV4);
  assert.match(second, uuidV4);
  assert.notEqual(first, second);
});
