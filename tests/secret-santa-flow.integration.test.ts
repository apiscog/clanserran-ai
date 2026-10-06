import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { assignments, groups, user } from "../src/db/schema";
import { DomainError } from "../src/lib/domain";
import {
  closeRegistrations,
  confirmPreviousRecipient,
  createGroup,
  getMemberFingerprint,
  getPrivateResultForUser,
  joinGroupByCode,
  joinGroupByInvite,
  runGroupDraw,
  saveGiftPreferences,
  type GiftPreferences,
} from "../src/lib/group-service";
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

    await rejectsWithCode(joinGroupByCode(db, randomUUID(), created.joinCode), "INVALID_CODE");
    await rejectsWithCode(joinGroupByInvite(db, randomUUID(), created.inviteToken), "INVALID_INVITE");
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
