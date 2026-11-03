import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { assignments, emailDeliveries, groups, user } from "@/db/schema";
import { assertAdmin, DomainError } from "@/lib/domain";
import { isDeliverableEmail } from "@/lib/email-address";
import type { EmailTransport } from "@/lib/email-transport";
import { EmailTransportError } from "@/lib/email-transport";
import { getPrivateResultForUser } from "@/lib/group-service";
import { buildDrawResultEmail } from "@/lib/notification-email";

const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_DELIVERIES_PER_RUN = 100;

async function claimNext(db: Database, groupId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${groupId}))`);
    const staleBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS);
    const [candidate] = await tx
      .select({ id: emailDeliveries.id, giverId: emailDeliveries.giverId })
      .from(emailDeliveries)
      .where(and(
        eq(emailDeliveries.groupId, groupId),
        or(
          eq(emailDeliveries.status, "pending"),
          and(
            eq(emailDeliveries.status, "sending"),
            or(isNull(emailDeliveries.claimedAt), lt(emailDeliveries.claimedAt, staleBefore)),
          ),
        ),
      ))
      .orderBy(asc(emailDeliveries.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;
    const [claimed] = await tx
      .update(emailDeliveries)
      .set({
        status: "sending",
        attempts: sql`${emailDeliveries.attempts} + 1`,
        claimedAt: new Date(),
        lastErrorCode: null,
        updatedAt: new Date(),
      })
      .where(eq(emailDeliveries.id, candidate.id))
      .returning({ id: emailDeliveries.id, giverId: emailDeliveries.giverId });
    return claimed ?? null;
  });
}

export async function deliverPendingDrawEmails(
  db: Database,
  groupId: string,
  baseUrl: string,
  transport: EmailTransport,
) {
  let sent = 0;
  let failed = 0;

  for (let index = 0; index < MAX_DELIVERIES_PER_RUN; index += 1) {
    const delivery = await claimNext(db, groupId);
    if (!delivery) break;
    try {
      const [giver] = await db
        .select({ email: user.email, name: user.name, emailVerified: user.emailVerified })
        .from(user)
        .where(eq(user.id, delivery.giverId))
        .limit(1);
      if (!giver || !isDeliverableEmail(giver.email, giver.emailVerified)) {
        throw new EmailTransportError("recipient_unavailable");
      }
      const result = await getPrivateResultForUser(db, groupId, delivery.giverId);
      const message = buildDrawResultEmail({
        giverName: giver.name,
        groupName: result.groupName,
        recipientName: result.recipientName,
        favoriteColor: result.favoriteColor,
        topSize: result.topSize,
        bottomSize: result.bottomSize,
        shoeSize: result.shoeSize,
        giftNotes: result.giftNotes,
        budget: result.budget,
        exchangeDate: result.exchangeDate,
        resultUrl: `${baseUrl}/grupos/${groupId}/resultado`,
        isReroll: Boolean(result.rerolledAt),
      });
      const accepted = await transport.send({
        recipient: { email: giver.email, name: giver.name },
        message,
        idempotencyKey: delivery.id,
      });
      await db
        .update(emailDeliveries)
        .set({ status: "sent", providerMessageId: accepted.messageId, sentAt: new Date(), updatedAt: new Date() })
        .where(and(eq(emailDeliveries.id, delivery.id), eq(emailDeliveries.status, "sending")));
      sent += 1;
    } catch (error) {
      const code = error instanceof EmailTransportError ? error.code : "internal_error";
      await db
        .update(emailDeliveries)
        .set({ status: "failed", lastErrorCode: code, updatedAt: new Date() })
        .where(and(eq(emailDeliveries.id, delivery.id), eq(emailDeliveries.status, "sending")));
      failed += 1;
    }
  }

  return { sent, failed };
}

export async function prepareDrawEmailRetry(db: Database, actorId: string, groupId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${groupId}))`);
    const [group] = await tx.select({ adminId: groups.adminId, status: groups.status }).from(groups).where(eq(groups.id, groupId)).limit(1).for("update");
    if (!group) throw new DomainError("El grupo no existe.", "NOT_FOUND");
    assertAdmin(group.adminId, actorId);
    if (group.status !== "drawn") throw new DomainError("El sorteo todavía no se ha realizado.", "INVALID_STATE");
    const assignedUsers = await tx
      .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
      .from(assignments)
      .innerJoin(user, eq(user.id, assignments.giverId))
      .where(eq(assignments.groupId, groupId));
    const missingDeliveries = assignedUsers
      .filter((participant) => isDeliverableEmail(participant.email, participant.emailVerified))
      .map((participant) => ({ groupId, giverId: participant.id }));
    if (missingDeliveries.length) await tx.insert(emailDeliveries).values(missingDeliveries).onConflictDoNothing();
    await tx
      .update(emailDeliveries)
      .set({ status: "pending", claimedAt: null, updatedAt: new Date() })
      .where(and(eq(emailDeliveries.groupId, groupId), inArray(emailDeliveries.status, ["failed"])));
  });
}
