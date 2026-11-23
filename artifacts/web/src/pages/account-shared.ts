import { getGetSupporterAccountQueryKey } from "@workspace/api-client-react";

export const accountKey = (token: string | null) => [...getGetSupporterAccountQueryKey(), token] as const;
export const authInit = (token: string | null, signal?: AbortSignal): RequestInit =>
  ({ signal, credentials: "include", headers: { Authorization: `Bearer ${token}` } });

export const FRIENDLY = [
  "Add a display name", "That photo is too small", "Choose a square JPG or PNG photo",
  "Use a photo smaller than 20 MB", "Keep your bio to 160 characters",
];
export const GENERIC = "Something went wrong, please try again";
export function friendlyError(e: unknown): string {
  const d = (e as { data?: { error?: unknown } } | null)?.data;
  const msg = typeof d?.error === "string" ? d.error : "";
  return FRIENDLY.includes(msg) ? msg : GENERIC;
}
