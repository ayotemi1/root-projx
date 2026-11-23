import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { normaliseContentLink } from "./feed-content.ts";
import { readFile } from "node:fs/promises";

const helper = await import("../../../web/src/lib/content-media.ts");

test("mixed organisation media keeps uploader order, deduplicates the cover and includes all slides", () => {
  assert.deepEqual(helper.orderedPostMedia({ imageUrl: "/first.jpg", mediaUrls: ["/first.jpg", "/clip.mov", "/second.jpg", "/last.mp4"] }),
    [{ url: "/first.jpg", type: "image" }, { url: "/clip.mov", type: "video" },
      { url: "/second.jpg", type: "image" }, { url: "/last.mp4", type: "video" }]);
  assert.deepEqual(helper.orderedPostMedia({ imageUrl: "/cover.jpg" }), [{ url: "/cover.jpg", type: "image" }]);
});

test("feed, profile and notification reading use the shared viewer rather than the old content pop-up", async () => {
  for (const file of ["pages/feed.tsx", "components/guest-feed/GuestFeed.tsx", "components/supporter/use-supporter-notifications.ts"]) {
    const source = await readFile(new URL(`../../../web/src/${file}`, import.meta.url), "utf8");
    assert.match(source, /viewer\.open\(/);
    assert.doesNotMatch(source, /<ContentDialog/);
  }
  const viewer = await readFile(new URL("../../../web/src/components/post-viewer/PostViewer.tsx", import.meta.url), "utf8");
  assert.match(viewer, /slideNavigation\.current\?\./);
  assert.match(viewer, /text-viewer-slide-count/);
});

test("the live /feed route uses the shared general-post feed, not the old updates-only home", async () => {
  const app = await readFile(new URL("../../../web/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /import FeedPage from ["']@\/pages\/feed["']/);
  assert.match(app, /<Route path="\/feed" component=\{FeedPage\}/);
});

test("gallery understands every saved link format and constructs trusted players only", () => {
  for (const url of [
    "https://youtube.com/watch?v=abcdefghijk", "https://m.youtube.com/watch?v=abcdefghijk",
    "https://youtube.com/shorts/abcdefghijk", "https://youtu.be/abcdefghijk",
    "https://vimeo.com/123456", "https://instagram.com/p/abc/",
    "https://instagram.com/reel/abc/", "https://instagram.com/tv/abc/",
  ]) {
    const parsed = helper.parseExternalLink(normaliseContentLink(url));
    assert.ok(parsed, url);
    if (parsed.provider === "instagram") assert.equal(parsed.embedUrl, null);
    else assert.match(parsed.embedUrl!, /^https:\/\/(www\.youtube-nocookie\.com\/embed\/[\w-]{11}|player\.vimeo\.com\/video\/\d+)$/);
  }
  for (const url of ["javascript:alert(1)", "https://youtube.com.evil.test/watch?v=abcdefghijk",
    "https://user:pass@youtube.com/watch?v=abcdefghijk", "https://youtu.be/abcdefghijk/extra",
    "https://vimeo.com/12345/secret", "https://instagram.com/reel/abc/extra"]) {
    assert.equal(helper.parseExternalLink(url), null, url);
  }
});

test("uploaded videos include MOV, MP4 and WebM even with URL parameters", () => {
  for (const url of ["/api/uploads/object/org-media/org/1/clip.MOV?token=1",
    "https://media.example.test/clip.mp4#t=1", "/video.webm", "/my%20clip.mp4"]) {
    assert.equal(helper.mediaKind(url), "video");
  }
  assert.equal(helper.mediaKind("https://media.example.test/image.jpg#a"), "image");
  const summary = helper.summarise({ mediaUrls: ["/photo.jpg", "/clip.mov"],
    externalUrl: "https://instagram.com/reel/abc/" });
  assert.equal(helper.matchesFilter(summary, "photos"), true);
  assert.equal(helper.matchesFilter(summary, "videos"), true);
  assert.equal(helper.matchesFilter(summary, "links"), true);
  assert.equal(helper.matchesFilter(helper.summarise({ externalUrl: "https://instagram.com/reel/abc/" }), "videos"), false);
});

test("public content gallery renders real cards, filters and distinct failure/empty states without auto-loading embeds", async () => {
  const root = new URL("../../../web/", import.meta.url);
  const require = createRequire(new URL("package.json", root));
  const result = await build({
    entryPoints: [new URL("src/components/org-content/content-gallery.tsx", root).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    plugins: [{ name: "viewer-presentation-boundary", setup(b) {
      b.onResolve({ filter: /post-viewer\/PostViewerProvider$/ }, () => ({ path: "viewer", namespace: "viewer-presentation" }));
      b.onLoad({ filter: /.*/, namespace: "viewer-presentation" }, () => ({ contents: "export const usePostViewer=()=>({open(){}});" }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, mod, mod.exports);
  const { createElement } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const render = (extra: object = {}) => renderToStaticMarkup(createElement(mod.exports.ContentGallery, {
    items: [{ _id: "post-1", title: "Community workshop", content: "Making progress",
      type: "update", createdAt: "2026-10-28T00:00:00Z",
      mediaUrls: ["/api/uploads/object/org-media/org/1/workshop.mp4"],
      externalUrl: "https://youtube.com/watch?v=abcdefghijk" }],
    isLoading: false, isError: false, onRetry() {}, ...extra,
  }));
  const html = render();
  assert.match(html, /Community workshop/);
  assert.match(html, /filter-content-videos/);
  assert.match(html, /filter-content-photos/);
  assert.match(html, /filter-content-links/);
  assert.match(html, /grid-cols-3 gap-1/);
  assert.match(html, /aspect-square/);
  assert.doesNotMatch(html, /<iframe/);
  assert.match(render({ isError: true }), /role="alert"/);
  assert.match(render({ isLoading: true }), /status-content-loading/);
  assert.doesNotMatch(render({ items: [] }), /Community workshop/);
  const feed = render({ feed: true, items: [{ _id: "video-post", orgId: "org",
    orgName: "Community Organisation", title: "", content: "", type: "update",
    mediaUrls: ["/device-video.mp4"], createdAt: "2026-10-28T00:00:00Z" }] });
  assert.match(feed, /Community Organisation/);
  assert.match(feed, /inline-video-player/);
  assert.doesNotMatch(feed, /<video[^>]+src=/, "Home must not request video bytes before Play");
  assert.doesNotMatch(feed, />Update</);
});
