export function safeDestination(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^\/(invitacion|grupos)(\/|$)/.test(candidate) && !candidate.startsWith("//") ? candidate : "/inicio";
}

export function invitationTokenFromDestination(destination: string) {
  const match = destination.match(/^\/invitacion\/([A-Za-z0-9_-]{40,60})$/);
  return match?.[1] ?? null;
}
