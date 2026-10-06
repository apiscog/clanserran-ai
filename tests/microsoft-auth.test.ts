import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getServerEnv, isServerConfigured } from "../src/lib/env";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@example.test/database",
  BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-bytes",
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  MICROSOFT_CLIENT_ID: "microsoft-client",
  MICROSOFT_CLIENT_SECRET: "microsoft-secret",
};

test("la validación del servidor exige y acepta las credenciales Microsoft", () => {
  assert.equal(isServerConfigured(validEnvironment), true);
  assert.equal(getServerEnv(validEnvironment).MICROSOFT_CLIENT_ID, "microsoft-client");
  const incomplete = { ...validEnvironment };
  delete incomplete.MICROSOFT_CLIENT_SECRET;
  assert.equal(isServerConfigured(incomplete), false);
});

test("Better Auth configura Microsoft para cuentas personales sin relajar la vinculación", () => {
  const authSource = read("src/lib/auth.ts");
  assert.match(authSource, /microsoft:\s*\{/);
  assert.match(authSource, /tenantId:\s*["']consumers["']/);
  assert.doesNotMatch(authSource, /trustedProviders|disableImplicitLinking|requireLocalEmailVerified/);
  assert.match(authSource, /google:\s*\{/);
  assert.match(authSource, /generateId:\s*generateAuthId/);
});

test("la portada conserva Google y ofrece Microsoft con destino /inicio", () => {
  const component = read("src/components/social-sign-in.tsx");
  const landing = read("src/app/page.tsx");
  assert.match(component, /provider="google"/);
  assert.match(component, /provider="microsoft"/);
  assert.match(component, /authClient\.signIn\.social\(\{/);
  assert.match(component, /Continuar con \$\{copy\.label\}/);
  assert.match(component, /Para cuentas Hotmail, Outlook o Live/);
  assert.match(landing, /: "\/inicio"/);
});

test("las credenciales Microsoft permanecen fuera del código cliente", () => {
  const clientFiles = ["src/components/social-sign-in.tsx", "src/lib/auth-client.ts"];
  for (const file of clientFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /MICROSOFT_CLIENT_(ID|SECRET)|NEXT_PUBLIC_MICROSOFT/);
  }
  assert.doesNotMatch(read(".env.example"), /NEXT_PUBLIC_MICROSOFT/);
});

test("la integración reutiliza la ruta real de Better Auth", () => {
  const route = read("src/app/api/auth/[...all]/route.ts");
  assert.match(route, /getAuth\(\)\.handler\(request\)/);
  assert.equal(read("package.json").includes("login simulado"), false);
});
