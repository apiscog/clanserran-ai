import test from "node:test";
import assert from "node:assert/strict";
import { findDraw } from "../src/lib/draw";

test("cada participante entrega y recibe exactamente una vez, sin autorregalo", () => {
  const ids = ["ana", "bea", "carlos", "dani", "eva"];
  const result = findDraw(ids, []);
  assert.equal(result.kind, "success");
  if (result.kind !== "success") return;
  assert.deepEqual(new Set(result.assignments.map((item) => item.giverId)), new Set(ids));
  assert.deepEqual(new Set(result.assignments.map((item) => item.recipientId)), new Set(ids));
  assert.ok(result.assignments.every((item) => item.giverId !== item.recipientId));
});

test("respeta exclusiones dirigidas sin crear la exclusión inversa", () => {
  const result = findDraw(["ana", "bea", "carlos"], [{ giverId: "ana", recipientId: "bea" }]);
  assert.equal(result.kind, "success");
  if (result.kind !== "success") return;
  assert.equal(result.assignments.find((item) => item.giverId === "ana")?.recipientId, "carlos");
  assert.equal(result.assignments.find((item) => item.giverId === "bea")?.recipientId, "ana");
});

test("demuestra un escenario imposible sin relajar restricciones", () => {
  const result = findDraw(
    ["ana", "bea", "carlos"],
    [
      { giverId: "ana", recipientId: "bea" },
      { giverId: "ana", recipientId: "carlos" },
    ],
  );
  assert.deepEqual(result, { kind: "impossible", visitedNodes: 0 });
});

test("distingue el límite operativo de una prueba de imposibilidad", () => {
  const result = findDraw(["ana", "bea", "carlos", "dani"], [], 0);
  assert.equal(result.kind, "limit");
});
