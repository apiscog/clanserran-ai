export function isDeliverableEmail(email: string, verified: boolean) {
  const normalized = email.trim().toLowerCase();
  return verified && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && !normalized.endsWith("@users.invalid");
}
