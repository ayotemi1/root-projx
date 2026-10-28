/** Allow supported public post links, never arbitrary embed markup or script URLs. */
export function normaliseContentLink(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) throw new Error("Invalid content link.");
  const raw = value.trim();
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Enter a valid HTTPS content link."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Enter a public HTTPS Instagram, YouTube or Vimeo link.");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const instagram = host === "instagram.com" && /^\/(p|reel|tv)\/[\w-]+\/?$/.test(url.pathname);
  const youtube = (["youtube.com", "m.youtube.com"].includes(host) &&
    ((url.pathname === "/watch" && /^[\w-]{11}$/.test(url.searchParams.get("v") ?? "")) ||
      /^\/shorts\/[\w-]{11}\/?$/.test(url.pathname))) ||
    (host === "youtu.be" && /^\/[\w-]{11}\/?$/.test(url.pathname));
  const vimeo = host === "vimeo.com" && /^\/\d+\/?$/.test(url.pathname);
  if (!instagram && !youtube && !vimeo) {
    throw new Error("Use an Instagram post or reel, YouTube video, or public Vimeo video link.");
  }
  url.hash = "";
  // Keep only the ID-bearing YouTube query, not social tracking parameters.
  const videoId = url.searchParams.get("v");
  url.search = "";
  if (url.pathname === "/watch" && videoId) url.searchParams.set("v", videoId);
  return url.toString();
}
