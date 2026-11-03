import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { assignments, emailDeliveries, groups, memberships, user } from "../src/db/schema";
import { DomainError } from "../src/lib/domain";
import {
  closeRegistrations,
  confirmPreviousRecipient,
  createGroup,
  deleteGroup,
  getMemberFingerprint,
  getPrivateResultForUser,
  joinGroupByCode,
  joinGroupByInvite,
  rerunGroupDraw,
  runGroupDraw,
  saveGiftPreferences,
  type GiftPreferences,
} from "../src/lib/group-service";
import { deliverPendingDrawEmails, prepareDrawEmailRetry } from "../src/lib/email-delivery-service";
import { EmailTransportError, type EmailTransport } from "../src/lib/email-transport";
import {
  assertIsolatedTestDatabase,
  assertTestSchemaIsMigrated,
  loadTestDatabaseEnvironment,
} from "../scripts/test-database";

const { testDatabaseUrl, applicationDatabaseUrl } = loadTestDatabaseEnvironment();

async function rejectsWithCode(operation: Promise<unknown>, code: string) {
  await assert.rejects(operation, (error) => error instanceof DomainError && error.code === code);
}

test("recorrido completo de amigo invisible con tres identidades", { skip: !testDatabaseUrl }, async () => {
  await assertIsolatedTestDatabase(testDatabaseUrl!, applicationDatabaseUrl);
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 4 });
  const db = drizzle({ client: pool, schema });
  const runId = randomUUID();
  const userIds = [randomUUID(), randomUUID(), randomUUID()] as const;
  const [userA, userB, userC] = userIds;
  const groupName = `Integración amigo invisible ${runId}`;
  let groupId: string | undefined;

  const preferences = new Map<string, GiftPreferences>([
    [userA, { favoriteColor: "Azul prueba", topSize: "M-prueba", bottomSize: "40-prueba", shoeSize: "42 EU prueba", giftNotes: null }],
    [userB, { favoriteColor: "Verde prueba", topSize: "S-prueba", bottomSize: "38-prueba", shoeSize: "39 EU prueba", giftNotes: "Fixture B" }],
    [userC, { favoriteColor: "Negro prueba", topSize: "L-prueba", bottomSize: "44-prueba", shoeSize: "43 EU prueba", giftNotes: "Fixture C" }],
  ]);

  try {
    await assertTestSchemaIsMigrated(pool);
    await db.insert(user).values([
      { id: userA, name: `Usuario A ${runId}`, email: `a-${runId}@example.test`, emailVerified: true, displayNameConfirmed: true },
      { id: userB, name: `Usuario B ${runId}`, email: `b-${runId}@example.test`, emailVerified: true, displayNameConfirmed: true },
      { id: userC, name: `Usuario C ${runId}`, email: `c-${runId}@example.test`, emailVerified: true, displayNameConfirmed: true },
    ]);

    const created = await createGroup(db, userA, { name: groupName, budget: "35.00", exchangeDate: "2030-12-24" });
    groupId = created.id;
    await joinGroupByCode(db, userB, created.joinCode);
    await joinGroupByInvite(db, userC, created.inviteToken);

    for (const userId of userIds) {
      await saveGiftPreferences(db, userId, groupId, preferences.get(userId)!);
    }

    const fingerprint = await getMemberFingerprint(db, groupId);
    await rejectsWithCode(runGroupDraw(db, userA, groupId, fingerprint), "INVALID_STATE");

    await closeRegistrations(db, userA, groupId, fingerprint);
    await rejectsWithCode(runGroupDraw(db, userA, groupId, fingerprint), "NOT_READY");

    await confirmPreviousRecipient(db, userA, groupId, { kind: "participant", recipientId: userB });
    await confirmPreviousRecipient(db, userB, groupId, { kind: "not_participated" });
    await confirmPreviousRecipient(db, userC, groupId, { kind: "not_participated" });

    await rejectsWithCode(runGroupDraw(db, userB, groupId, fingerprint), "FORBIDDEN");
    await rejectsWithCode(runGroupDraw(db, userC, groupId, fingerprint), "FORBIDDEN");
    await runGroupDraw(db, userA, groupId, fingerprint);

    const queued = await db.select().from(emailDeliveries).where(eq(emailDeliveries.groupId, groupId));
    assert.equal(queued.length, 3);
    assert.ok(queued.every((delivery) => delivery.status === "pending"));

    const successfulMessages: Parameters<EmailTransport["send"]>[0][] = [];
    let failUserBOnce = true;
    const transport: EmailTransport = {
      async send(input) {
        if (input.recipient.email.startsWith("b-") && failUserBOnce) {
          failUserBOnce = false;
          throw new EmailTransportError("fixture_failure");
        }
        successfulMessages.push(input);
        return { messageId: `fixture-${input.idempotencyKey}` };
      },
    };
    const firstDelivery = await deliverPendingDrawEmails(db, groupId, "https://example.test", transport);
    assert.deepEqual(firstDelivery, { sent: 2, failed: 1 });
    await rejectsWithCode(prepareDrawEmailRetry(db, userB, groupId), "FORBIDDEN");
    await prepareDrawEmailRetry(db, userA, groupId);
    const retryDelivery = await deliverPendingDrawEmails(db, groupId, "https://example.test", transport);
    assert.deepEqual(retryDelivery, { sent: 1, failed: 0 });
    assert.equal(successfulMessages.length, 3);
    assert.equal(new Set(successfulMessages.map((message) => message.idempotencyKey)).size, 3);
    assert.deepEqual(await deliverPendingDrawEmails(db, groupId, "https://example.test", transport), { sent: 0, failed: 0 });
    assert.equal(successfulMessages.length, 3);

    for (const sent of successfulMessages) {
      const giverId = sent.recipient.email.startsWith("a-") ? userA : sent.recipient.email.startsWith("b-") ? userB : userC;
      const privateResult = await getPrivateResultForUser(db, groupId, giverId);
      assert.match(sent.message.text, new RegExp(`Te toca regalar a: ${privateResult.recipientName}`));
      assert.match(sent.message.text, new RegExp(privateResult.favoriteColor!));
      assert.match(sent.message.html, /AmigoInvisibleClan/);
    }

    const firstAssignments = await db.select().from(assignments).where(eq(assignments.groupId, groupId));
    assert.equal(firstAssignments.length, 3);
    assert.deepEqual(new Set(firstAssignments.map((item) => item.giverId)), new Set(userIds));
    assert.deepEqual(new Set(firstAssignments.map((item) => item.recipientId)), new Set(userIds));
    assert.ok(firstAssignments.every((item) => item.giverId !== item.recipientId));
    assert.notEqual(firstAssignments.find((item) => item.giverId === userA)?.recipientId, userB);

    for (const userId of userIds) {
      const result = await getPrivateResultForUser(db, groupId, userId);
      const expected = preferences.get(result.recipientId)!;
      assert.equal(result.giverId, userId);
      assert.equal(result.favoriteColor, expected.favoriteColor);
      assert.equal(result.topSize, expected.topSize);
      assert.equal(result.bottomSize, expected.bottomSize);
      assert.equal(result.shoeSize, expected.shoeSize);
      assert.equal(result.giftNotes, expected.giftNotes);
    }

    const adminResult = await getPrivateResultForUser(db, groupId, userA);
    assert.equal(adminResult.giverId, userA);
    await rejectsWithCode(getPrivateResultForUser(db, groupId, userA, userB), "FORBIDDEN");

    const snapshot = firstAssignments
      .map(({ giverId, recipientId }) => `${giverId}:${recipientId}`)
      .sort();
    await rejectsWithCode(runGroupDraw(db, userA, groupId, fingerprint), "ALREADY_DRAWN");
    const afterRetry = await db.select().from(assignments).where(eq(assignments.groupId, groupId));
    assert.deepEqual(afterRetry.map(({ giverId, recipientId }) => `${giverId}:${recipientId}`).sort(), snapshot);

    await db
      .update(emailDeliveries)
      .set({ status: "sending", claimedAt: new Date() })
      .where(eq(emailDeliveries.id, queued[0]!.id));
    await rejectsWithCode(rerunGroupDraw(db, userA, groupId), "EMAILS_IN_PROGRESS");
    await db
      .update(emailDeliveries)
      .set({ status: "sent", claimedAt: null })
      .where(eq(emailDeliveries.id, queued[0]!.id));
    await rejectsWithCode(rerunGroupDraw(db, userB, groupId), "FORBIDDEN");

    const concurrentRerolls = await Promise.allSettled([
      rerunGroupDraw(db, userA, groupId),
      rerunGroupDraw(db, userA, groupId),
    ]);
    assert.equal(concurrentRerolls.filter((result) => result.status === "fulfilled").length, 1);
    const rejectedReroll = concurrentRerolls.find((result) => result.status === "rejected");
    assert.ok(rejectedReroll?.status === "rejected");
    const rerolledGroup = (await db.select().from(groups).where(eq(groups.id, groupId)))[0]!;
    assert.ok(rerolledGroup.rerolledAt instanceof Date);
    const rerolledAssignments = await db.select().from(assignments).where(eq(assignments.groupId, groupId));
    assert.equal(rerolledAssignments.length, 3);
    assert.deepEqual(new Set(rerolledAssignments.map((item) => item.giverId)), new Set(userIds));
    assert.deepEqual(new Set(rerolledAssignments.map((item) => item.recipientId)), new Set(userIds));
    assert.ok(rerolledAssignments.every((item) => item.giverId !== item.recipientId));
    assert.notEqual(rerolledAssignments.find((item) => item.giverId === userA)?.recipientId, userB);

    const rerolledDeliveries = await db.select().from(emailDeliveries).where(eq(emailDeliveries.groupId, groupId));
    assert.equal(rerolledDeliveries.length, 3);
    assert.ok(rerolledDeliveries.every((delivery) => delivery.status === "pending"));
    assert.deepEqual(await deliverPendingDrawEmails(db, groupId, "https://example.test", transport), { sent: 3, failed: 0 });
    const updatedMessages = successfulMessages.slice(3);
    assert.equal(updatedMessages.length, 3);
    assert.equal(new Set(successfulMessages.map((message) => message.idempotencyKey)).size, 6);
    assert.ok(updatedMessages.every((message) => message.message.subject === "Tu resultado de Amigo Invisible ha cambiado"));
    assert.ok(updatedMessages.every((message) => /resultado anterior ya no es válido/.test(message.message.text)));
    for (const sent of updatedMessages) {
      const giverId = sent.recipient.email.startsWith("a-") ? userA : sent.recipient.email.startsWith("b-") ? userB : userC;
      const privateResult = await getPrivateResultForUser(db, groupId, giverId);
      assert.match(sent.message.text, new RegExp(`Te toca regalar a: ${privateResult.recipientName}`));
      assert.match(sent.message.text, new RegExp(privateResult.favoriteColor!));
    }
    await rejectsWithCode(rerunGroupDraw(db, userA, groupId), "REROLL_USED");
    const afterSecondRerollAttempt = await db.select().from(assignments).where(eq(assignments.groupId, groupId));
    assert.deepEqual(
      afterSecondRerollAttempt.map(({ giverId, recipientId }) => `${giverId}:${recipientId}`).sort(),
      rerolledAssignments.map(({ giverId, recipientId }) => `${giverId}:${recipientId}`).sort(),
    );

    await rejectsWithCode(joinGroupByCode(db, randomUUID(), created.joinCode), "INVALID_CODE");
    await rejectsWithCode(joinGroupByInvite(db, randomUUID(), created.inviteToken), "INVALID_INVITE");

    await rejectsWithCode(deleteGroup(db, userB, groupId), "FORBIDDEN");
    await deleteGroup(db, userA, groupId);
    assert.equal((await db.select().from(groups).where(eq(groups.id, groupId))).length, 0);
    assert.equal((await db.select().from(memberships).where(eq(memberships.groupId, groupId))).length, 0);
    assert.equal((await db.select().from(assignments).where(eq(assignments.groupId, groupId))).length, 0);
    assert.equal((await db.select().from(emailDeliveries).where(eq(emailDeliveries.groupId, groupId))).length, 0);
    assert.equal((await db.select().from(user).where(inArray(user.id, [...userIds]))).length, 3);
    await rejectsWithCode(deleteGroup(db, userA, groupId), "NOT_FOUND");
    groupId = undefined;
  } finally {
    try {
      if (groupId) await db.delete(groups).where(eq(groups.id, groupId));
    } finally {
      try {
        await db.delete(user).where(inArray(user.id, [...userIds]));
      } finally {
        await pool.end();
      }
    }
  }
});
