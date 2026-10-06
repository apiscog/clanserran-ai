export type GroupStatus = "open" | "closed" | "drawn";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function assertMember(memberUserIds: readonly string[], userId: string) {
  if (!memberUserIds.includes(userId)) {
    throw new DomainError("No perteneces a este grupo.", "FORBIDDEN");
  }
}

export function assertAdmin(adminId: string, userId: string) {
  if (adminId !== userId) {
    throw new DomainError("Solo la persona administradora puede realizar esta acción.", "FORBIDDEN");
  }
}

export function assertCanReadAssignment(giverId: string, userId: string) {
  if (giverId !== userId) {
    throw new DomainError("Solo puedes consultar tu propia asignación.", "FORBIDDEN");
  }
}

export function assertCanRunDraw(input: {
  adminId: string;
  actorId: string;
  status: GroupStatus;
  members: readonly { giftDataCompleted: boolean; previousAnswerConfirmed: boolean }[];
}) {
  assertAdmin(input.adminId, input.actorId);
  if (input.status === "drawn") throw new DomainError("Este grupo ya tiene sorteo y no se puede repetir.", "ALREADY_DRAWN");
  if (input.status !== "closed") throw new DomainError("Primero debes cerrar las inscripciones.", "INVALID_STATE");
  if (input.members.length < 3) throw new DomainError("Se necesitan al menos tres participantes.", "TOO_FEW_MEMBERS");
  if (input.members.some((member) => !member.giftDataCompleted || !member.previousAnswerConfirmed)) {
    throw new DomainError("Todas las personas deben completar sus datos y confirmar el año anterior.", "NOT_READY");
  }
}

export function invalidateAnnualConfirmations<T extends { previousAnswerConfirmed: boolean; previousRecipientId: string | null; previousAnswerKind: string | null }>(members: T[]) {
  return members.map((member) => ({
    ...member,
    previousAnswerConfirmed: false,
    previousRecipientId: null,
    previousAnswerKind: null,
  }));
}
