import { randomInt } from "node:crypto";
import { DomainError } from "@/lib/domain";

export type DrawAssignment = { giverId: string; recipientId: string };
export type DirectedExclusion = { giverId: string; recipientId: string };

export type DrawResult =
  | { kind: "success"; assignments: DrawAssignment[]; visitedNodes: number }
  | { kind: "impossible"; visitedNodes: number }
  | { kind: "limit"; visitedNodes: number };

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export function findDraw(
  participantIds: readonly string[],
  exclusions: readonly DirectedExclusion[],
  maxVisitedNodes = 250_000,
): DrawResult {
  const unique = [...new Set(participantIds)];
  if (unique.length !== participantIds.length) throw new DomainError("Hay participantes duplicados.", "INVALID_MEMBERS");
  if (unique.length < 3) throw new DomainError("Se necesitan al menos tres participantes.", "TOO_FEW_MEMBERS");

  const allowed = new Map<string, string[]>();
  for (const giverId of unique) {
    const blocked = new Set(exclusions.filter((item) => item.giverId === giverId).map((item) => item.recipientId));
    allowed.set(giverId, shuffled(unique.filter((recipientId) => recipientId !== giverId && !blocked.has(recipientId))));
  }

  const givers = shuffled(unique).sort((a, b) => allowed.get(a)!.length - allowed.get(b)!.length);
  if (givers.some((giverId) => allowed.get(giverId)!.length === 0)) return { kind: "impossible", visitedNodes: 0 };

  let visitedNodes = 0;
  let hitLimit = false;
  const used = new Set<string>();
  const chosen = new Map<string, string>();

  function search(position: number): boolean {
    if (position === givers.length) return true;
    if (visitedNodes >= maxVisitedNodes) {
      hitLimit = true;
      return false;
    }
    const giverId = givers[position]!;
    for (const recipientId of allowed.get(giverId)!) {
      visitedNodes += 1;
      if (used.has(recipientId)) continue;
      used.add(recipientId);
      chosen.set(giverId, recipientId);
      if (search(position + 1)) return true;
      chosen.delete(giverId);
      used.delete(recipientId);
      if (hitLimit) return false;
    }
    return false;
  }

  if (!search(0)) return hitLimit ? { kind: "limit", visitedNodes } : { kind: "impossible", visitedNodes };
  return {
    kind: "success",
    visitedNodes,
    assignments: unique.map((giverId) => ({ giverId, recipientId: chosen.get(giverId)! })),
  };
}
