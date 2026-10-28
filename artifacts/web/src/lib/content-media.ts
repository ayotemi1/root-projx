/** Media helpers for the organisation content library. Pure functions, no DOM. */

export type MediaKind = "image" | "video";
export type FilterKey = "all" | "photos" | "videos" | "links";

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|ogv)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic)$/i;

/** Path of a URL without query/hash, decoded where possible. */
function pathOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url, "https://x.invalid").pathname);
  } catch {
    return url.split(/[?#]/)[0] ?? url;
  }
}

/** Classify an uploaded media URL. Query params and hashes are ignored. */
export function mediaKind(url: string): MediaKind {
  const p = pathOf(url);
  if (VIDEO_EXT.test(p)) return "video";
  if (IMAGE_EXT.test(p)) return "image";
  return /(^|[/_.-])video([/_.-]|$)/i.test(p) ? "video" : "image";
}

export type ExternalProvider = "youtube" | "vimeo" | "instagram";

export interface ExternalLink {
  provider: ExternalProvider;
  url: string;
  /** Safe, constructed embed URL. Null for Instagram (never embedded). */
  embedUrl: string | null;
  label: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Parse an allowed HTTPS external video link. Returns null when not allowed. */
export function parseExternalLink(raw: string | null | undefined): ExternalLink | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port || raw.length > 2048) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  if (host === "youtube.com" || host === "m.youtube.com") {
    let id: string | null = null;
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else if (/^\/shorts\/[\w-]{11}\/?$/.test(u.pathname)) id = parts[1] ?? null;
    if (id && YT_ID.test(id)) {
      return { provider: "youtube", url: u.toString(), embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, label: "YouTube" };
    }
    return null;
  }
  if (host === "youtu.be") {
    const id = parts[0];
    if (id && YT_ID.test(id) && /^\/[\w-]{11}\/?$/.test(u.pathname)) {
      return { provider: "youtube", url: u.toString(), embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, label: "YouTube" };
    }
    return null;
  }
  if (host === "vimeo.com") {
    const id = parts[0];
    if (id && /^\d+$/.test(id) && /^\/\d+\/?$/.test(u.pathname)) {
      return { provider: "vimeo", url: u.toString(), embedUrl: `https://player.vimeo.com/video/${id}`, label: "Vimeo" };
    }
    return null;
  }
  if (host === "instagram.com") {
    if (/^\/(p|reel|tv)\/[\w-]+\/?$/.test(u.pathname)) {
      return { provider: "instagram", url: u.toString(), embedUrl: null, label: "Instagram" };
    }
    return null;
  }
  return null;
}

export const EXTERNAL_LINK_HELP =
  "Use an https link to an Instagram post or reel, a YouTube video or Short, or a Vimeo video.";

/** Validation message for a composer value, or null when valid/empty. */
export function externalLinkError(raw: string): string | null {
  if (!raw.trim()) return null;
  return parseExternalLink(raw) ? null : `That link isn't supported. ${EXTERNAL_LINK_HELP}`;
}

export interface ContentItemSummary {
  images: string[];
  videos: string[];
  link: ExternalLink | null;
}

export function summarise(post: { mediaUrls?: string[] | null; imageUrl?: string | null; externalUrl?: string | null }): ContentItemSummary {
  const urls = [...(post.mediaUrls ?? [])];
  if (post.imageUrl && !urls.includes(post.imageUrl)) urls.unshift(post.imageUrl);
  const images: string[] = [];
  const videos: string[] = [];
  for (const u of urls) (mediaKind(u) === "video" ? videos : images).push(u);
  return { images, videos, link: parseExternalLink(post.externalUrl) };
}

export function matchesFilter(s: ContentItemSummary, f: FilterKey): boolean {
  if (f === "photos") return s.images.length > 0;
  if (f === "videos") return s.videos.length > 0 || (!!s.link && s.link.provider !== "instagram");
  if (f === "links") return !!s.link;
  return true;
}
