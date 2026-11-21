import {
  completeSupporterPostUpload, followSupporter, listSupporterPosts, publishSupporterPost,
  removeSupporterPost, requestSupporterPostUpload, unfollowSupporter,
  type ListSupporterPostsParams, type SupporterMediaUploadInputContentType, type SupporterPostInput,
  type SupporterPostMedia, type SupporterPostRecord,
} from "@workspace/api-client-react";
import { appFetch as fetch } from "./error-feedback";
import { SP_KEY } from "./supporter-post-cache";
export { SP_KEY, cachePublishedPost } from "./supporter-post-cache";

export type { SupporterPostRecord, SupporterPostMedia };
export const GENERIC_SHARE_ERROR = "Something went wrong, please try again";

const auth = (token: string | null | undefined): RequestInit =>
  token ? { headers: { Authorization: `Bearer ${token}` }, credentials: "include" } : { credentials: "include" };

/** Query-key root for every supporter-post list, so one invalidation refreshes feed/profile/public pages. */
export const spKey = (params: ListSupporterPostsParams, token?: string | null) => [SP_KEY, params.feed ?? null, params.publicId ?? null, token ?? null] as const;

export const listPosts = (params: ListSupporterPostsParams, token?: string | null) => listSupporterPosts(params, auth(token));
export const followAuthor = (publicId: string, token: string) => followSupporter(publicId, auth(token));
export const unfollowAuthor = (publicId: string, token: string) => unfollowSupporter(publicId, auth(token));
export const deletePost = (id: string, token: string) => removeSupporterPost(id, auth(token));
export const publishPost = (body: SupporterPostInput, token: string) => publishSupporterPost(body, auth(token));

export const requestUpload = (file: File, contentType: SupporterMediaUploadInputContentType, token: string) =>
  requestSupporterPostUpload({ name: file.name.slice(0, 255) || "media", size: file.size, contentType }, auth(token));
/** Poll the same completion route while the server is still preparing the media (HTTP 202 {processing:true}). */
export async function completeUpload(objectPath: string, token: string, onProcessing?: () => void): Promise<SupporterPostMedia> {
  const deadline = Date.now() + 20 * 60_000;
  for (;;) {
    const res = (await completeSupporterPostUpload({ objectPath }, auth(token))) as SupporterPostMedia | { processing?: boolean } | null;
    if (res && "id" in res && res.id && "url" in res && res.url) return res as SupporterPostMedia;
    if (Date.now() > deadline) throw new Error("processing timeout");
    onProcessing?.();
    await new Promise(r => setTimeout(r, 2500));
  }
}

/** Follow state for a public supporter, independent of whether they have posts. */
export async function getFollowStatus(publicId: string, token: string): Promise<boolean> {
  const res = await fetch(`/api/supporter-posts/follows/${encodeURIComponent(publicId)}`, auth(token));
  if (!res.ok) throw new Error(`follow status ${res.status}`);
  const body = (await res.json()) as { following?: boolean };
  return body.following === true;
}

/** Direct PUT of the original binary to the signed URL with real progress. */
export function putToSignedUrl(url: string, file: File, contentType: string, onProgress: (f: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? (onProgress(1), resolve()) : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(file);
  });
}

/** Clear the HttpOnly private-media cookie; survives page unload. Never throws. */
export function clearMediaSession(token: string | null | undefined) {
  try {
    void fetch("/api/supporter-posts/media-session", {
      method: "DELETE", keepalive: true, credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => undefined);
  } catch { /* ignore */ }
}

export const newPostId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16));
