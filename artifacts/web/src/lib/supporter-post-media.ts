import { MAX_VIDEO_BYTES, formatUploadSize } from "./upload-feedback";

// Match the existing feed-image batch and direct-video upload limits. These
// checks are for a local draft, not permission to use organisation upload APIs.
export const MAX_POST_ITEMS = 5;
export const MAX_POST_IMAGE_BYTES = 20 * 1024 * 1024;
export const POST_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const POST_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const POST_MEDIA_ACCEPT = [...POST_IMAGE_TYPES, ...POST_VIDEO_TYPES].join(",");
export const POST_MEDIA_LIMITS_COPY =
  "Choose up to 5 photos or videos for one swipeable post. JPG, PNG, GIF or WebP: up to 20 MB each. MP4, MOV or WebM: up to 500 MB each. HEIC isn’t supported. There is no fixed video-duration limit.";

export type PostMediaKind = "image" | "video";

export function postMediaKind(file: Pick<File, "type">): PostMediaKind | null {
  if ((POST_IMAGE_TYPES as readonly string[]).includes(file.type)) return "image";
  if ((POST_VIDEO_TYPES as readonly string[]).includes(file.type)) return "video";
  return null;
}

export function selectPostMedia(files: readonly File[], existingCount: number): {
  accepted: File[];
  errors: string[];
} {
  const accepted: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const name = file.name || "This file";
    const kind = postMediaKind(file);
    if (!kind) {
      errors.push(`${name}: this format isn’t supported. Export HEIC photos as JPG or PNG. Choose JPG, PNG, GIF, WebP, MP4, MOV or WebM.`);
    } else if (!file.size) {
      errors.push(`${name}: this file is empty. Choose the original file or export it again.`);
    } else if (kind === "image" && file.size > MAX_POST_IMAGE_BYTES) {
      errors.push(`${name}: this image is ${formatUploadSize(file.size)}. The maximum is 20 MB per image. Resize it or export a smaller JPG, PNG or WebP.`);
    } else if (kind === "video" && file.size > MAX_VIDEO_BYTES) {
      errors.push(`${name}: this video is ${formatUploadSize(file.size)}. The maximum is 500 MB per video. Trim it or export a smaller version, for example at 720p.`);
    } else if (existingCount + accepted.length >= MAX_POST_ITEMS) {
      errors.push(`${name}: a post can contain up to 5 photos or videos. Remove an item before adding another.`);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, errors };
}
