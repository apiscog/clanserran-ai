import "server-only";

import { asc, eq } from "drizzle-orm";
import { unstable_noStore as noStore } from "next/cache";
import { getDb } from "@/db";
import { groups, memberships, user } from "@/db/schema";
import { DomainError } from "@/lib/domain";
import { getPrivateResultForUser } from "@/lib/group-service";

export async function getMyGroups(userId: string) {
  noStore();
  return getDb()
    .select({
      id: groups.id,
      name: groups.name,
      status: groups.status,
      budget: groups.budget,
      exchangeDate: groups.exchangeDate,
      adminId: groups.adminId,
      giftDataCompleted: memberships.giftDataCompleted,
      previousAnswerConfirmed: memberships.previousAnswerConfirmed,
    })
    .from(memberships)
    .innerJoin(groups, eq(groups.id, memberships.groupId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(groups.exchangeDate), asc(groups.name));
}

export async function getOwnProfile(userId: string) {
  noStore();
  const [profile] = await getDb()
    .select({ name: user.name, displayNameConfirmed: user.displayNameConfirmed })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!profile) throw new DomainError("No se encontró tu perfil.", "NOT_FOUND");
  return profile;
}

export async function getGroupPage(groupId: string, userId: string) {
  noStore();
  const [group] = await getDb().select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw new DomainError("El grupo no existe.", "NOT_FOUND");

  const members = await getDb()
    .select({
      userId: memberships.userId,
      name: user.name,
      giftDataCompleted: memberships.giftDataCompleted,
      previousAnswerConfirmed: memberships.previousAnswerConfirmed,
      favoriteColor: memberships.favoriteColor,
      topSize: memberships.topSize,
      bottomSize: memberships.bottomSize,
      shoeSize: memberships.shoeSize,
      giftNotes: memberships.giftNotes,
      previousRecipientId: memberships.previousRecipientId,
      previousAnswerKind: memberships.previousAnswerKind,
    })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.groupId, groupId))
    .orderBy(asc(user.name));

  const current = members.find((member) => member.userId === userId);
  if (!current) throw new DomainError("No perteneces a este grupo.", "FORBIDDEN");
  return { group, members, current, isAdmin: group.adminId === userId };
}

export async function getPrivateResult(groupId: string, userId: string) {
  noStore();
  return getPrivateResultForUser(getDb(), groupId, userId);
}
