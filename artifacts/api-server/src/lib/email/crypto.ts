import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

function rootSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("Email security is not configured.");
  return secret;
}
/** Identifiers live only in server-private collections. They must remain stable
 * across encryption/session-secret rotation or webhook replay can resend mail. */
export function emailRecordId(purpose: string, value: string): string {
  return createHash("sha256").update(JSON.stringify(["email-v1", purpose, value])).digest("hex");
}
function encryptionKey() {
  return Buffer.from(hkdfSync("sha256", rootSecret(), "rootprojx-email-v1", "private-outbox-payload", 32));
}
export function sealEmail(value: unknown, recordId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`email-v1:${recordId}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function openEmail<T>(value: string, recordId: string): T {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Invalid encrypted email.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(parts[1]!, "base64url"));
    decipher.setAAD(Buffer.from(`email-v1:${recordId}`));
    decipher.setAuthTag(Buffer.from(parts[2]!, "base64url"));
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(parts[3]!, "base64url")), decipher.final(),
    ]).toString("utf8")) as T;
  } catch {
    throw new Error("Could not open private email.");
  }
}
