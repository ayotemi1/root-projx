import { randomUUID } from "node:crypto";
import type { SupporterAccount, SupporterAccountProfileInput, SupporterAccountSettingsInput } from "@workspace/api-zod";
import { fsGet, fsMutateSupporterAccount } from "./firebase-rest.js";
import { accountPreferences, verifiedNotificationEmail, notificationDeliveryFor } from "./supporter-preferences.js";

export const ACCOUNT_ERROR = "Something went wrong, please try again";
export class AccountError extends Error {
  constructor(public status: number, message = ACCOUNT_ERROR) { super(message); }
}
export type AccountDoc = Record<string, any>;
export const initialLetters = (name: string) => name.trim().split(/\s+/u).map(p => [...p][0] ?? "").slice(0, 2).join("").toUpperCase() || "S";
export const safeAvatar = (v: unknown): string | null => typeof v === "string" && /^(https?:\/\/|\/api\/)/.test(v) ? v : null;
export function accountView(user: AccountDoc, verifiedEmail: string): SupporterAccount {
  const pp = user.publicProfile ?? {};
  const displayName = typeof pp.displayName === "string" && pp.displayName.trim() ? pp.displayName : String(user.name || "");
  return {
    displayName, location: String(user.profileShowcase?.location || ""), bio: String(pp.bio || ""),
    avatarUrl: safeAvatar(user.avatarUrl), avatarInitials: initialLetters(displayName),
    email: verifiedEmail, visibility: pp.enabled === true ? "public" : "private", ...accountPreferences(user),
  };
}
export async function accountUser(uid: string, token: string): Promise<AccountDoc> {
  const user = await fsGet("users", uid, token);
  if (!user || user.accountType !== "supporter") throw new AccountError(403);
  return user;
}
export async function saveAccountProfile(uid: string, body: SupporterAccountProfileInput, token: string) {
  const name = body.displayName.trim();
  if (!name) throw new AccountError(400, "Add a display name");
  const candidate = `sp_${randomUUID().replaceAll("-", "")}`;
  await fsMutateSupporterAccount(uid, token, (user: AccountDoc) => ({
    name, avatarInitials: initialLetters(name),
    publicProfile: { ...(user.publicProfile ?? {}), publicId: user.publicProfile?.publicId || candidate,
      displayName: name, bio: body.bio },
    profileShowcase: { ...(user.profileShowcase ?? {}), location: body.location.trim() },
    ...(body.photoId === undefined ? {} : {
      avatarPhotoId: body.photoId,
      avatarUrl: body.photoId ? `/api/supporter-posts/media/avatars/${body.photoId}` : null,
    }),
  }));
}
export async function saveAccountSetting(uid: string, body: SupporterAccountSettingsInput, token: string) {
  if (Object.keys(body).length !== 1) throw new AccountError(400);
  if (body.notification?.category === "receipts" && body.notification.channel === "email" && !body.notification.enabled)
    throw new AccountError(400, "Receipts and security emails are always sent.");
  const candidate = `sp_${randomUUID().replaceAll("-", "")}`;
  await fsMutateSupporterAccount(uid, token, (user: AccountDoc) => {
    if (body.visibility) return { publicProfile: { ...(user.publicProfile ?? {}),
      enabled: body.visibility === "public", publicId: user.publicProfile?.publicId || candidate,
      displayName: user.publicProfile?.displayName || user.name || "Supporter",
      bio: user.publicProfile?.bio || "" } };
    const current = accountPreferences(user);
    if (body.messagePolicy) current.messagePolicy = body.messagePolicy;
    else if (body.notification) {
      const { category, channel, enabled } = body.notification;
      current.notifications[category][channel] = enabled;
    } else throw new AccountError(400);
    return { profileShowcase: { ...(user.profileShowcase ?? {}), settings: {
      ...(user.profileShowcase?.settings ?? {}), ...current,
    } } };
  });
}

// A browser-writable profile email is never a trusted delivery identity.
// Bind the address verified by Firebase to this UID with a server-only MAC.
export async function rememberNotificationEmail(uid: string, email: string, token: string) {
  const user = await accountUser(uid, token);
  if (verifiedNotificationEmail(uid, user) === email) return;
  const notificationDelivery = notificationDeliveryFor(uid, email);
  await fsMutateSupporterAccount(uid, token, () => ({ notificationDelivery }));
}
