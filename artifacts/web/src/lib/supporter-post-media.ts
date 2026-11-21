import type { CSSProperties } from "react";
import { MAX_VIDEO_BYTES, formatUploadSize } from "./upload-feedback";

// Supporter posts: the backend contract accepts exactly these formats.
export const MAX_POST_ITEMS = 5;
export const MAX_POST_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_POST_VIDEO_SECONDS = 600;
export const MAX_CAPTION = 5000;
export const POST_IMAGE_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"] as const;
export const POST_VIDEO_TYPES = ["video/mp4", "video/quicktime"] as const;
export type PostContentType = (typeof POST_IMAGE_TYPES)[number] | (typeof POST_VIDEO_TYPES)[number];
const EXT_TYPES: Record<string, PostContentType> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime",
};
export const POST_MEDIA_ACCEPT = [...POST_IMAGE_TYPES, ...POST_VIDEO_TYPES, ".heic", ".heif", ".mov"].join(",");
export const POST_MEDIA_LIMITS_COPY =
  "Up to 5 photos or videos in one swipeable post. JPG, PNG or HEIC photos up to 20 MB each. MP4 or MOV videos up to 500 MB and 10 minutes each.";

export type PostMediaKind = "image" | "video";

/** Resolve a supported content type, falling back to the extension when the browser reports none (common for HEIC/MOV). */
export function postContentType(file: Pick<File, "type" | "name">): PostContentType | null {
  const t = (file.type || "").toLowerCase();
  if ((POST_IMAGE_TYPES as readonly string[]).includes(t) || (POST_VIDEO_TYPES as readonly string[]).includes(t)) return t as PostContentType;
  if (t && t !== "application/octet-stream") return null;
  const ext = (file.name || "").split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? null;
}

export function postMediaKind(file: Pick<File, "type"> & Partial<Pick<File, "name">>): PostMediaKind | null {
  const t = postContentType({ type: file.type, name: file.name ?? "" });
  if (!t) return null;
  return t.startsWith("video/") ? "video" : "image";
}

export const isHeic = (file: Pick<File, "type" | "name">) => {
  const t = postContentType(file);
  return t === "image/heic" || t === "image/heif";
};

/** Give native files with an empty MIME a real type without copying bytes. */
export function snapshotFile(file: File): File {
  const t = postContentType(file);
  if (!t || file.type === t) return file;
  return new File([file], file.name, { type: t, lastModified: file.lastModified });
}

export function selectPostMedia(files: readonly File[], existingCount: number): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const name = file.name || "This file";
    const kind = postMediaKind(file);
    if (!kind) {
      errors.push(`${name}: this format isn’t supported. Choose a JPG, PNG or HEIC photo, or an MP4 or MOV video.`);
    } else if (!file.size) {
      errors.push(`${name}: this file is empty. Choose the original file or export it again.`);
    } else if (kind === "image" && file.size > MAX_POST_IMAGE_BYTES) {
      errors.push(`${name}: this photo is ${formatUploadSize(file.size)}. The maximum is 20 MB per photo. Resize it or export a smaller JPG.`);
    } else if (kind === "video" && file.size > MAX_VIDEO_BYTES) {
      errors.push(`${name}: this video is ${formatUploadSize(file.size)}. The maximum is 500 MB per video. Trim it or export a smaller version, for example at 720p.`);
    } else if (existingCount + accepted.length >= MAX_POST_ITEMS) {
      errors.push(`${name}: a post can contain up to 5 photos or videos. Remove an item before adding another.`);
    } else {
      accepted.push(snapshotFile(file));
    }
  }
  return { accepted, errors };
}

export function videoDurationError(name: string, seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= MAX_POST_VIDEO_SECONDS) return null;
  const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
  return `${name}: this video is ${m}m ${String(s).padStart(2, "0")}s. Videos can be up to 10 minutes. Trim it, then select it again.`;
}

/**
 * What a failed browser preview means. Valid MP4/MOV videos may use codecs (e.g. HEVC) the browser can't decode;
 * the server transcodes those, so they stay shareable with a neutral placeholder. Known errors (duration, conversion)
 * and unreadable images remain fatal.
 */
export type PreviewFailure = "unsupported-preview" | "broken";
export function previewFailureOutcome(file: Pick<File, "type" | "name">, knownError?: string | null): PreviewFailure {
  if (knownError) return "broken";
  return postMediaKind(file) === "video" ? "unsupported-preview" : "broken";
}
export const VIDEO_PREVIEW_UNSUPPORTED_COPY = "This browser can’t preview this video. We’ll prepare it when you share.";

// ── Non-destructive editing ────────────────────────────────────────────────
export type CropAspect = "original" | "1:1" | "4:5" | "16:9";
export type MediaFilter = "original" | "warm" | "cool" | "mono";
export type MediaEdit = {
  crop: { aspect: CropAspect; zoom: number; x: number; y: number };
  filter: MediaFilter;
  adjustments: { brightness: number; contrast: number; saturation: number };
};
export const CROP_ASPECTS: CropAspect[] = ["original", "1:1", "4:5", "16:9"];
export const FILTERS: Array<{ id: MediaFilter; label: string }> = [
  { id: "original", label: "Original" }, { id: "warm", label: "Warm" }, { id: "cool", label: "Cool" }, { id: "mono", label: "Mono" },
];
export const defaultEdit = (): MediaEdit => ({
  crop: { aspect: "original", zoom: 1, x: 0, y: 0 },
  filter: "original",
  adjustments: { brightness: 1, contrast: 1, saturation: 1 },
});
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
export function normaliseEdit(e: Partial<MediaEdit> | null | undefined): MediaEdit {
  const d = defaultEdit();
  const c = e?.crop ?? d.crop;
  const a = e?.adjustments ?? d.adjustments;
  return {
    crop: {
      aspect: CROP_ASPECTS.includes(c.aspect) ? c.aspect : "original",
      zoom: clamp(c.zoom, 1, 3), x: clamp(c.x, -50, 50), y: clamp(c.y, -50, 50),
    },
    filter: FILTERS.some(f => f.id === e?.filter) ? e!.filter! : "original",
    adjustments: { brightness: clamp(a.brightness, .5, 1.5), contrast: clamp(a.contrast, .5, 1.5), saturation: clamp(a.saturation, 0, 2) },
  };
}

const FILTER_CSS: Record<MediaFilter, string> = {
  original: "",
  warm: "sepia(.28) saturate(1.2) hue-rotate(-10deg)",
  cool: "hue-rotate(14deg) saturate(.85) brightness(1.03)",
  mono: "grayscale(1) contrast(1.08)",
};
export function editFilterCss(e: Pick<MediaEdit, "filter" | "adjustments">): string {
  const { brightness: b, contrast: c, saturation: s } = e.adjustments;
  return `${FILTER_CSS[e.filter] ?? ""} brightness(${b}) contrast(${c}) saturate(${s})`.trim();
}
export function aspectRatio(aspect: CropAspect, natural: number | null): number {
  if (aspect === "1:1") return 1;
  if (aspect === "4:5") return 4 / 5;
  if (aspect === "16:9") return 16 / 9;
  return natural && Number.isFinite(natural) && natural > 0 ? natural : 4 / 5;
}
/** Style for the <img>/<video> inside a fixed-ratio, overflow-hidden frame. */
export function editMediaStyle(e: MediaEdit): CSSProperties {
  const ox = 50 + e.crop.x, oy = 50 + e.crop.y;
  return {
    objectFit: "cover",
    objectPosition: `${ox}% ${oy}%`,
    transformOrigin: `${ox}% ${oy}%`,
    transform: e.crop.zoom !== 1 ? `scale(${e.crop.zoom})` : undefined,
    filter: editFilterCss(e) || undefined,
  };
}

/** Profile visibility as stored by the backend (user.publicProfile.enabled), tolerating the settings DTO shape. */
export function profileIsPublic(p: { publicProfile?: { enabled?: boolean } | null; publicProfileSettings?: { enabled?: boolean } | null } | null | undefined): boolean {
  return (p?.publicProfile?.enabled ?? p?.publicProfileSettings?.enabled) === true;
}
