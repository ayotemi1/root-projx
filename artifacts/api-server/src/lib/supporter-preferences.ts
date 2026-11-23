import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupporterNotificationPreferences } from "@workspace/api-zod";

type User = Record<string, any>;
const categories = ["updates", "comments", "messages", "campaigns", "receipts"] as const;
export function accountPreferences(user: User): { messagePolicy: "followed" | "replies"; notifications: SupporterNotificationPreferences } {
  const settings = user.profileShowcase?.settings ?? {};
  const notifications = {} as SupporterNotificationPreferences;
  for (const key of categories) {
    const saved = settings.notifications?.[key];
    notifications[key] = {
      inApp: typeof saved?.inApp === "boolean" ? saved.inApp : true,
      email: key === "receipts" || (typeof saved?.email === "boolean" ? saved.email : !["updates", "comments"].includes(key)),
    };
  }
  return { messagePolicy: settings.messagePolicy === "replies" ? "replies" : "followed", notifications };
}
function deliveryMac(uid: string, email: string) {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("Account notification signing unavailable");
  return createHmac("sha256", key).update(JSON.stringify(["notification-address-v1", uid, email])).digest("hex");
}
export function notificationDeliveryFor(uid: string, email: string) {
  return { email, proof: deliveryMac(uid, email) };
}
export function verifiedNotificationEmail(uid: string, user: User): string | null {
  const delivery = user.notificationDelivery;
  if (!delivery || typeof delivery.email !== "string" || typeof delivery.proof !== "string") return null;
  const expected = deliveryMac(uid, delivery.email);
  const a = Buffer.from(delivery.proof), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? delivery.email : null;
}
