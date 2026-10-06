"use server";

import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { codeLookupLimits, groups, memberships, user } from "@/db/schema";
import { assertAdmin, DomainError } from "@/lib/domain";
import {
  closeRegistrations,
  confirmPreviousRecipient,
  createGroup,
  joinGroupByCode,
  joinGroupByInvite,
  runGroupDraw,
  saveGiftPreferences,
} from "@/lib/group-service";
import { requireUser } from "@/lib/session";
import { createGroupSchema, fieldErrors, preferencesSchema, profileSchema, type ActionState } from "@/lib/validation";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function uuidValue(formData: FormData, key: string) {
  const candidate = value(formData, key);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)) {
    throw new DomainError("El identificador recibido no es válido.", "INVALID_INPUT");
  }
  return candidate;
}

function errorState(error: unknown): ActionState {
  if (error instanceof DomainError) return { status: "error", message: error.message };
  if (error instanceof Error && error.message.includes("Configuración incompleta")) {
    return { status: "error", message: "La aplicación aún no está conectada. Revisa la configuración del servidor." };
  }
  console.error("Operación fallida", { type: error instanceof Error ? error.name : "UnknownError", code: (error as { code?: string })?.code });
  return { status: "error", message: "No hemos podido completar la acción. Inténtalo de nuevo." };
}

export async function updateProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const currentUser = await requireUser();
    const parsed = profileSchema.safeParse({ name: value(formData, "name") });
    if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };
    await getDb().update(user).set({ name: parsed.data.name, displayNameConfirmed: true, updatedAt: new Date() }).where(eq(user.id, currentUser.id));
    revalidatePath("/inicio");
    return { status: "success", message: "Nombre actualizado." };
  } catch (error) {
    return errorState(error);
  }
}

export async function createGroupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await requireUser();
  const parsed = createGroupSchema.safeParse({
    name: value(formData, "name"),
    budget: value(formData, "budget"),
    exchangeDate: value(formData, "exchangeDate"),
  });
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };

  try {
    const created = await createGroup(getDb(), currentUser.id, {
      name: parsed.data.name,
      budget: parsed.data.budget ? parsed.data.budget.replace(",", ".") : null,
      exchangeDate: parsed.data.exchangeDate || null,
    });
    redirect(`/grupos/${created.id}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return errorState(error);
  }
}

async function consumeCodeAttempt(userId: string) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  const keyHash = createHash("sha256").update(`${userId}:${ip}`).digest("hex");
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${keyHash}))`);
    const [current] = await tx.select().from(codeLookupLimits).where(eq(codeLookupLimits.keyHash, keyHash)).limit(1);
    if (!current || current.windowStartedAt < windowStart) {
      await tx
        .insert(codeLookupLimits)
        .values({ keyHash, windowStartedAt: now, attempts: 1 })
        .onConflictDoUpdate({ target: codeLookupLimits.keyHash, set: { windowStartedAt: now, attempts: 1 } });
      return;
    }
    if (current.attempts >= 8) throw new DomainError("Demasiados intentos. Espera 15 minutos antes de probar otro código.", "RATE_LIMITED");
    await tx.update(codeLookupLimits).set({ attempts: current.attempts + 1 }).where(eq(codeLookupLimits.keyHash, keyHash));
  });
}

export async function joinByCodeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const currentUser = await requireUser();
    const code = value(formData, "code").trim();
    if (!/^\d{6}$/.test(code)) return { status: "error", fields: { code: "El código tiene exactamente 6 dígitos." } };
    if (value(formData, "confirm") !== "yes") return { status: "error", fields: { confirm: "Confirma que quieres unirte." } };
    await consumeCodeAttempt(currentUser.id);
    const groupId = await joinGroupByCode(getDb(), currentUser.id, code);
    redirect(`/grupos/${groupId}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return errorState(error);
  }
}

export async function joinByInviteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const currentUser = await requireUser();
    const token = value(formData, "token");
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new DomainError("La invitación no es válida.", "INVALID_INVITE");
    if (value(formData, "confirm") !== "yes") return { status: "error", fields: { confirm: "Confirma que quieres unirte." } };
    const groupId = await joinGroupByInvite(getDb(), currentUser.id, token);
    redirect(`/grupos/${groupId}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return errorState(error);
  }
}

export async function savePreferencesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const currentUser = await requireUser();
    const parsed = preferencesSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };
    const { groupId, ...data } = parsed.data;
    await saveGiftPreferences(getDb(), currentUser.id, groupId, data);
    revalidatePath(`/grupos/${groupId}`);
    revalidatePath(`/grupos/${groupId}/resultado`);
    return { status: "success", message: "Datos del regalo guardados." };
  } catch (error) {
    return errorState(error);
  }
}

export async function confirmPreviousAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const currentUser = await requireUser();
    const groupId = uuidValue(formData, "groupId");
    const answer = value(formData, "answer");
    if (answer === "not_participated" || answer === "absent") {
      await confirmPreviousRecipient(getDb(), currentUser.id, groupId, { kind: answer });
    } else {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(answer)) {
        throw new DomainError("La persona elegida no es válida.", "INVALID_RECIPIENT");
      }
      await confirmPreviousRecipient(getDb(), currentUser.id, groupId, { kind: "participant", recipientId: answer });
    }
    revalidatePath(`/grupos/${groupId}`);
    return { status: "success", message: "Respuesta del año anterior confirmada." };
  } catch (error) {
    return errorState(error);
  }
}

export async function closeRegistrationsAction(formData: FormData) {
  const currentUser = await requireUser();
  const groupId = uuidValue(formData, "groupId");
  if (value(formData, "confirm") !== "yes") throw new DomainError("Debes confirmar la lista antes de cerrarla.", "CONFIRMATION_REQUIRED");
  await closeRegistrations(getDb(), currentUser.id, groupId, value(formData, "memberFingerprint"));
  revalidatePath(`/grupos/${groupId}`);
}

export async function reopenRegistrationsAction(formData: FormData) {
  const currentUser = await requireUser();
  const groupId = uuidValue(formData, "groupId");
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${groupId}))`);
    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (!group) throw new DomainError("El grupo no existe.", "NOT_FOUND");
    assertAdmin(group.adminId, currentUser.id);
    if (group.status !== "closed") throw new DomainError("Solo se puede reabrir antes del sorteo.", "INVALID_STATE");
    await tx.update(groups).set({ status: "open", updatedAt: new Date() }).where(eq(groups.id, groupId));
    await tx
      .update(memberships)
      .set({ previousAnswerConfirmed: false, previousRecipientId: null, previousAnswerKind: null, updatedAt: new Date() })
      .where(eq(memberships.groupId, groupId));
  });
  revalidatePath(`/grupos/${groupId}`);
}

export async function removeMemberAction(formData: FormData) {
  const currentUser = await requireUser();
  const groupId = uuidValue(formData, "groupId");
  const memberId = value(formData, "memberId");
  await getDb().transaction(async (tx) => {
    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1).for("update");
    if (!group) throw new DomainError("El grupo no existe.", "NOT_FOUND");
    assertAdmin(group.adminId, currentUser.id);
    if (group.status !== "open") throw new DomainError("La lista está bloqueada.", "INVALID_STATE");
    if (memberId === group.adminId) throw new DomainError("La persona administradora no puede retirarse.", "ADMIN_CANNOT_LEAVE");
    await tx.delete(memberships).where(and(eq(memberships.groupId, groupId), eq(memberships.userId, memberId)));
  });
  revalidatePath(`/grupos/${groupId}`);
}

export async function leaveGroupAction(formData: FormData) {
  const currentUser = await requireUser();
  const groupId = uuidValue(formData, "groupId");
  await getDb().transaction(async (tx) => {
    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1).for("update");
    if (!group || group.status !== "open") throw new DomainError("No puedes salir con la lista cerrada.", "INVALID_STATE");
    if (group.adminId === currentUser.id) throw new DomainError("La persona administradora no puede salir de su propio grupo.", "ADMIN_CANNOT_LEAVE");
    await tx.delete(memberships).where(and(eq(memberships.groupId, groupId), eq(memberships.userId, currentUser.id)));
  });
  redirect("/inicio");
}

export async function runDrawAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const currentUser = await requireUser();
    const groupId = uuidValue(formData, "groupId");
    if (value(formData, "confirm") !== "yes") throw new DomainError("Confirma la lista definitiva antes del sorteo.", "CONFIRMATION_REQUIRED");
    await runGroupDraw(getDb(), currentUser.id, groupId, value(formData, "memberFingerprint"));
    revalidatePath(`/grupos/${groupId}`);
    return { status: "success", message: "Sorteo realizado. Cada persona ya puede ver su resultado." };
  } catch (error) {
    return errorState(error);
  }
}
