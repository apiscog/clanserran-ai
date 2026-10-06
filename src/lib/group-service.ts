import { randomBytes, randomInt } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { assignments, groups, memberships, user } from "@/db/schema";
import { assertAdmin, assertCanReadAssignment, assertCanRunDraw, DomainError } from "@/lib/domain";
import { findDraw } from "@/lib/draw";

export type GiftPreferences = {
  favoriteColor: string;
  topSize: string;
  bottomSize: string;
  shoeSize: string;
  giftNotes: string | null;
};

export async function createGroup(
  db: Database,
  actorId: string,
  input: { name: string; budget: string | null; exchangeDate: string | null },
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const inviteToken = randomBytes(32).toString("base64url");
    try {
      return await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(groups)
          .values({ ...input, joinCode, inviteToken, adminId: actorId })
          .returning({ id: groups.id });
        await tx.insert(memberships).values({ groupId: created!.id, userId: actorId });
        return { id: created!.id, joinCode, inviteToken };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") continue;
      throw error;
    }
  }
  throw new DomainError("No se pudo generar un código único. Inténtalo de nuevo.", "CODE_COLLISION_LIMIT");
}

export async function joinGroupByCode(db: Database, actorId: string, code: string) {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: groups.id, status: groups.status })
      .from(groups)
      .where(eq(groups.joinCode, code))
      .limit(1)
      .for("update");
    if (!candidate || candidate.status !== "open") {
      throw new DomainError("El código no es válido o las inscripciones ya están cerradas.", "INVALID_CODE");
    }
    await tx.insert(memberships).values({ groupId: candidate.id, userId: actorId }).onConflictDoNothing();
    return candidate.id;
  });
}

export async function joinGroupByInvite(db: Database, actorId: string, token: string) {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: groups.id, status: groups.status })
      .from(groups)
      .where(eq(groups.inviteToken, token))
      .limit(1)
      .for("update");
    if (!candidate || candidate.status !== "open") {
      throw new DomainError("La invitación no es válida o las inscripciones ya están cerradas.", "INVALID_INVITE");
    }
    await tx.insert(memberships).values({ groupId: candidate.id, userId: actorId }).onConflictDoNothing();
    return candidate.id;
  });
}

export async function saveGiftPreferences(db: Database, actorId: string, groupId: string, input: GiftPreferences) {
  const [updated] = await db
    .update(memberships)
    .set({ ...input, giftDataCompleted: true, updatedAt: new Date() })
    .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, actorId)))
    .returning({ groupId: memberships.groupId });
  if (!updated) throw new DomainError("No perteneces a este grupo.", "FORBIDDEN");
}

export async function getMemberFingerprint(db: Database, groupId: string) {
  const members = await db.select({ userId: memberships.userId }).from(memberships).where(eq(memberships.groupId, groupId));
  return members.map((member) => member.userId).sort().join(",");
}

export async function closeRegistrations(db: Database, actorId: string, groupId: string, expectedFingerprint: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${groupId}))`);
    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1).for("update");
    if (!group) throw new DomainError("El grupo no existe.", "NOT_FOUND");
    assertAdmin(group.adminId, actorId);
    if (group.status !== "open") throw new DomainError("Las inscripciones ya no están abiertas.", "INVALID_STATE");
    const currentMembers = await tx.select({ userId: memberships.userId }).from(memberships).where(eq(memberships.groupId, groupId));
    const currentFingerprint = currentMembers.map((member) => member.userId).sort().join(",");
    if (currentFingerprint !== expectedFingerprint) {
      throw new DomainError("La lista ha cambiado. Revísala de nuevo antes de cerrar.", "STALE_MEMBERS");
    }
    await tx.update(groups).set({ status: "closed", updatedAt: new Date() }).where(eq(groups.id, groupId));
  });
}

export async function confirmPreviousRecipient(
  db: Database,
  actorId: string,
  groupId: string,
  answer: { kind: "participant"; recipientId: string } | { kind: "not_participated" | "absent" },
) {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group || group.status !== "closed") {
    throw new DomainError("La respuesta anual solo se confirma con la lista cerrada.", "INVALID_STATE");
  }

  let previousRecipientId: string | null = null;
  if (answer.kind === "participant") {
    previousRecipientId = answer.recipientId;
    if (previousRecipientId === actorId) throw new DomainError("No puedes elegirte a ti mismo.", "INVALID_RECIPIENT");
    const [recipient] = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, previousRecipientId)))
      .limit(1);
    if (!recipient) throw new DomainError("La persona elegida no participa en este grupo.", "INVALID_RECIPIENT");
  }

  const [updated] = await db
    .update(memberships)
    .set({
      previousAnswerKind: answer.kind,
      previousRecipientId,
      previousAnswerConfirmed: true,
      updatedAt: new Date(),
    })
    .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, actorId)))
    .returning({ userId: memberships.userId });
  if (!updated) throw new DomainError("No perteneces a este grupo.", "FORBIDDEN");
}

export async function runGroupDraw(db: Database, actorId: string, groupId: string, expectedFingerprint: string) {
  return db.transaction(
    async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${groupId}))`);
      const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
      if (!group) throw new DomainError("El grupo no existe.", "NOT_FOUND");
      const members = await tx.select().from(memberships).where(eq(memberships.groupId, groupId));
      const currentFingerprint = members.map((member) => member.userId).sort().join(",");
      if (currentFingerprint !== expectedFingerprint) {
        throw new DomainError("La lista ha cambiado. Revísala de nuevo antes del sorteo.", "STALE_MEMBERS");
      }
      assertCanRunDraw({ adminId: group.adminId, actorId, status: group.status, members });
      const result = findDraw(
        members.map((member) => member.userId),
        members
          .filter((member) => member.previousAnswerKind === "participant" && member.previousRecipientId)
          .map((member) => ({ giverId: member.userId, recipientId: member.previousRecipientId! })),
      );
      if (result.kind === "impossible") throw new DomainError("No existe una combinación válida con las exclusiones actuales.", "IMPOSSIBLE_DRAW");
      if (result.kind === "limit") throw new DomainError("La búsqueda alcanzó el límite operativo. No se ha guardado ningún resultado.", "SEARCH_LIMIT");

      await tx.insert(assignments).values(result.assignments.map((item) => ({ groupId, ...item })));
      const [updated] = await tx
        .update(groups)
        .set({ status: "drawn", drawnAt: new Date(), updatedAt: new Date() })
        .where(and(eq(groups.id, groupId), ne(groups.status, "drawn")))
        .returning({ id: groups.id });
      if (!updated) throw new DomainError("Este grupo ya tiene sorteo.", "ALREADY_DRAWN");
      return result.assignments;
    },
    { isolationLevel: "serializable" },
  );
}

export async function getPrivateResultForUser(
  db: Database,
  groupId: string,
  actorId: string,
  requestedGiverId = actorId,
) {
  assertCanReadAssignment(requestedGiverId, actorId);
  const [result] = await db
    .select({
      giverId: assignments.giverId,
      recipientId: assignments.recipientId,
      recipientName: user.name,
      favoriteColor: memberships.favoriteColor,
      topSize: memberships.topSize,
      bottomSize: memberships.bottomSize,
      shoeSize: memberships.shoeSize,
      giftNotes: memberships.giftNotes,
      groupName: groups.name,
      budget: groups.budget,
      exchangeDate: groups.exchangeDate,
      status: groups.status,
    })
    .from(assignments)
    .innerJoin(groups, eq(groups.id, assignments.groupId))
    .innerJoin(user, eq(user.id, assignments.recipientId))
    .innerJoin(
      memberships,
      and(eq(memberships.groupId, assignments.groupId), eq(memberships.userId, assignments.recipientId)),
    )
    .where(and(eq(assignments.groupId, groupId), eq(assignments.giverId, requestedGiverId)))
    .limit(1);
  if (!result) throw new DomainError("No hay un resultado disponible para ti.", "NOT_FOUND");
  return result;
}
