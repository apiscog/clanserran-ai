import test from "node:test";
import assert from "node:assert/strict";
import {
  localRegistrationSchema,
  normalizeRecoveryCode,
  normalizeUsername,
  passwordChecks,
  passwordSchema,
  usernameSchema,
} from "../src/lib/local-access";

test("normaliza el usuario igual en cliente y servidor", () => {
  assert.equal(normalizeUsername("María Serran"), "mariaserran");
  assert.equal(usernameSchema.parse("  María-Serrán  "), "mariaserran");
  assert.equal(usernameSchema.safeParse("1234").success, false);
  assert.equal(usernameSchema.safeParse("admín").success, false);
});

test("la contraseña exige cuatro caracteres, minúscula, mayúscula y número", () => {
  assert.equal(passwordSchema.safeParse("Aa1x").success, true);
  assert.equal(passwordSchema.safeParse("Aa1").success, false);
  assert.deepEqual(passwordChecks("Aa1x"), { length: true, lowercase: true, uppercase: true, number: true });
  assert.equal(passwordSchema.safeParse("abcd1").success, false);
  assert.equal(passwordSchema.safeParse("ABCD1").success, false);
  assert.equal(passwordSchema.safeParse("Abcde").success, false);
});

test("el alta requiere invitación válida y confirmación coincidente", () => {
  const base = {
    name: "María Serrán",
    username: "Maria Serran",
    password: "Aa1x",
    passwordConfirmation: "Aa1x",
    inviteToken: "a".repeat(48),
  };
  assert.equal(localRegistrationSchema.parse(base).username, "mariaserran");
  assert.equal(localRegistrationSchema.safeParse({ ...base, passwordConfirmation: "Aa2x" }).success, false);
  assert.equal(localRegistrationSchema.safeParse({ ...base, inviteToken: "corta" }).success, false);
  assert.equal(normalizeRecoveryCode("abcd-efgh-jklm-npqr"), "ABCDEFGHJKLMNPQR");
});
