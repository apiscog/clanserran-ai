import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCanReadAssignment,
  assertCanRerunDraw,
  assertCanRunDraw,
  assertMember,
  DomainError,
  invalidateAnnualConfirmations,
} from "../src/lib/domain";

function expectsCode(callback: () => void, code: string) {
  assert.throws(callback, (error) => error instanceof DomainError && error.code === code);
}

test("un usuario ajeno no supera la autorización de miembro", () => {
  expectsCode(() => assertMember(["ana", "bea"], "intruso"), "FORBIDDEN");
});

test("un participante que no administra no puede ejecutar el sorteo", () => {
  expectsCode(
    () => assertCanRunDraw({ adminId: "ana", actorId: "bea", status: "closed", members: Array(3).fill({ giftDataCompleted: true, previousAnswerConfirmed: true }) }),
    "FORBIDDEN",
  );
});

test("ni la persona administradora puede consultar la asignación ajena", () => {
  expectsCode(() => assertCanReadAssignment("bea", "ana"), "FORBIDDEN");
  assert.doesNotThrow(() => assertCanReadAssignment("ana", "ana"));
});

test("la segunda ejecución queda rechazada por el estado ya sorteado", () => {
  expectsCode(
    () => assertCanRunDraw({ adminId: "ana", actorId: "ana", status: "drawn", members: Array(3).fill({ giftDataCompleted: true, previousAnswerConfirmed: true }) }),
    "ALREADY_DRAWN",
  );
});

test("solo el administrador puede consumir la única repetición", () => {
  const members = Array(3).fill({ giftDataCompleted: true, previousAnswerConfirmed: true });
  expectsCode(() => assertCanRerunDraw({ adminId: "ana", actorId: "bea", status: "drawn", rerolledAt: null, members }), "FORBIDDEN");
  assert.doesNotThrow(() => assertCanRerunDraw({ adminId: "ana", actorId: "ana", status: "drawn", rerolledAt: null, members }));
  expectsCode(() => assertCanRerunDraw({ adminId: "ana", actorId: "ana", status: "drawn", rerolledAt: new Date(), members }), "REROLL_USED");
});

test("reabrir invalida las confirmaciones anuales y conserva el resto", () => {
  const [member] = invalidateAnnualConfirmations([{ previousAnswerConfirmed: true, previousRecipientId: "bea", previousAnswerKind: "participant", favoriteColor: "verde" }]);
  assert.deepEqual(member, { previousAnswerConfirmed: false, previousRecipientId: null, previousAnswerKind: null, favoriteColor: "verde" });
});
