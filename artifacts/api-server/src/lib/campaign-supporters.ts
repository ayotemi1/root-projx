import { createHash } from "node:crypto";
import { fsQuery } from "./firebase-rest.js";

export function donorIdentity(input: { userId?: string; email?: string; anonymousDonorId?: string; stripeRef: string }) {
  const email = input.email?.trim().toLowerCase();
  if (email) return "email:" + createHash("sha256").update(email).digest("hex");
  if (input.userId && !["guest", "anonymous"].includes(input.userId)) return "user:" + input.userId;
  if (input.anonymousDonorId) return "device:" + createHash("sha256").update(input.anonymousDonorId).digest("hex");
  // Historical unidentified gifts cannot safely be attributed to a person.
  return "unidentified:" + input.stripeRef;
}

export function firstNameLastInitial(value: unknown): string {
  if (typeof value !== "string") return "Anonymous";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Anonymous";
  return (parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]!.toUpperCase()}.` : parts[0]!).slice(0, 80);
}

export function summariseSupporters(donations: Record<string, unknown>[], wall: unknown = []) {
  const names = new Map<string, string>();
  const hidden = new Set<string>();
  if (Array.isArray(wall)) for (const row of wall) {
    if (row && row.optedIn === false && typeof row.userId === "string") hidden.add(row.userId);
    if (row && row.optedIn === true && typeof row.userId === "string") names.set(row.userId, firstNameLastInitial(row.displayName));
  }
  const aliases = new Map<string, string>();
  for (const row of donations) {
    if (typeof row.userId === "string" && !["guest", "anonymous"].includes(row.userId) && typeof row.donorIdentityKey === "string") aliases.set(row.userId, row.donorIdentityKey);
  }
  const seenPayments = new Set<string>();
  const seenPeople = new Set<string>();
  let unidentifiedGifts = 0;
  const recent: { displayName: string; createdAt: string }[] = [];
  const supporterUnits: { displayName: string; createdAt: string }[] = [];
  let supporterCount = 0;
  const sorted = [...donations].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  for (const row of sorted) {
    if (typeof row.status === "string" && !["succeeded", "paid", "completed"].includes(row.status)) continue;
    if (typeof row.stripeRef !== "string" || !row.stripeRef || seenPayments.has(row.stripeRef)) continue;
    seenPayments.add(row.stripeRef);
    const key = typeof row.donorIdentityKey === "string" ? row.donorIdentityKey
      : aliases.get(String(row.userId)) ?? donorIdentity({ userId: typeof row.userId === "string" ? row.userId : undefined,
        email: typeof row.guestEmail === "string" ? row.guestEmail : undefined, stripeRef: row.stripeRef });
    if (seenPeople.has(key)) continue;
    seenPeople.add(key);
    if (key.startsWith("unidentified:")) unidentifiedGifts++;
    else supporterCount++;
    const displayName = hidden.has(String(row.userId)) ? "Anonymous" : typeof row.publicDonorName === "string" ? firstNameLastInitial(row.publicDonorName)
      : row.publicDonorName === null ? "Anonymous" : names.get(String(row.userId)) ?? "Anonymous";
    if (recent.length < 6) recent.push({ displayName, createdAt: String(row.createdAt ?? "") });
    // Match the actual counted people, not historical unidentified gifts.
    // Public artwork gets only the same consent-filtered names as the wall.
    if (!key.startsWith("unidentified:") && supporterUnits.length < 300) {
      supporterUnits.push({ displayName, createdAt: String(row.createdAt ?? "") });
    }
  }
  return { supporterCount, unidentifiedGifts, recentSupporters: recent, supporterUnits };
}

export async function campaignSupporters(orgId: string, campaignId: string, token: string, wall: unknown = []) {
  const rows = await fsQuery("donations", [{ field: "orgId", op: "EQUAL", value: orgId },
    { field: "campaignId", op: "EQUAL", value: campaignId }], token);
  return summariseSupporters(rows, wall);
}
