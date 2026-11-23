// Preview-only test accounts/posts. Never change an existing organisation post.
// Generated credentials are private and are never written to stdout.
import { build } from "esbuild";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { execFile as exec } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(exec), path = "/tmp/rootprojx-post-viewer-fixture.json";
async function load(name) {
  const r = await build({ entryPoints: [new URL(`../src/lib/${name}.ts`, import.meta.url).pathname], bundle: true,
    write: false, platform: "node", format: "esm", packages: "external" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
}
const db = await load("firebase-rest"), server = await db.getServerToken();
const original = new URL("./post-viewer-preview-fixture.mjs", import.meta.url).pathname;
if (process.argv[2] === "cleanup") {
  const f = JSON.parse(await readFile(path, "utf8"));
  const own = await db.fsQuery("supporter_posts", [{ field: "author_id", op: "EQUAL", value: f.uid }], server);
  f.posts = own.map(p => ({ id: p._id || p.id, type: p.type, mediaIds: p.media_ids || [] }));
  const ids = new Set([...(f.orgPosts || []), ...f.posts.map(p => p.id)]);
  for (const id of f.orgPosts || []) await db.fsPatch("updates", id, { status: "deleted", removed: true, removed_at: new Date().toISOString() }, server);
  if (f.orgId) {
    await db.fsMutateSupporterShowcase(f.orgId, server, u => ({ ...(u.profileShowcase || {}),
      pinnedPosts: (u.profileShowcase?.pinnedPosts || []).filter(k => !(f.orgPosts || []).some(id => k === `update:${id}`)),
      ...(Array.isArray(u.profileShowcase?.bookmarks)
        ? { bookmarks: u.profileShowcase.bookmarks.filter(b => !ids.has(b.targetId)) } : {}),
    }));
    const rows = await db.fsQuery("post_interactions", [{ field: "uid", op: "EQUAL", value: f.orgId }], server);
    for (const row of rows) if (ids.has(String(row.postKey).split(":").at(-1)) || ids.has(row.post_id) || ids.has(row.postId))
      await db.fsDelete("post_interactions", row._id, server);
  }
  for (const uid of [f.uid, f.orgId].filter(Boolean)) {
    const media = await db.fsQuery("supporter_post_media", [{ field: "author_id", op: "EQUAL", value: uid }], server);
    for (const m of media) if (uid === f.uid || ids.has(m.post_id))
      await db.fsPatch("supporter_post_media", m._id || m.id, { state: "discarded", status: "discarded" }, server);
  }
  await writeFile(path, JSON.stringify(f), { mode: 0o600 });
  await run(process.execPath, [original, "cleanup"]);
  for (const file of [f.testImagePath, f.testVideoPath].filter(Boolean)) await unlink(file).catch(() => {});
  console.log("Removed isolated Preview interactions/login and hid all isolated test posts; existing posts and pins were preserved.");
} else {
  await run(process.execPath, [original]);
  const f = JSON.parse(await readFile(path, "utf8"));
  f.publicId = `preview-editor-${f.uid.slice(0, 10).toLowerCase()}`;
  await db.fsPatch("users", f.uid, { publicProfile: { enabled: true, displayName: f.name, bio: "Isolated Preview test account", publicId: f.publicId } }, server);
  const extra = randomUUID();
  await db.fsPatch("supporter_posts", extra, { id: extra, author_id: f.uid, type: "text", caption: "Isolated fourth post for the three-pin limit",
    media_ids: [], removed: false, created_at: new Date().toISOString(), edited_at: null }, server);
  f.posts.push({ id: extra, type: "text", mediaIds: [] });
  f.orgId = "wjrO1hiK6gfS7og1KVSjs5euRlC2";
  const real = await db.fsGet("updates", f.orgPostId, server);
  const org = await db.fsGet("organisations", f.orgId, server);
  f.orgPosts = [randomUUID(), randomUUID()];
  await writeFile(path, JSON.stringify(f), { mode: 0o600 });
  for (const [i, id] of f.orgPosts.entries()) await db.fsPatch("updates", id, {
    orgId: f.orgId, orgName: org.name, title: "Isolated Preview editor check",
    content: `Temporary isolated ${i ? "photo" : "video"} post for editor checks. Not a real organisation update.`,
    type: "update", mediaUrls: i ? [org.coverImage] : real.mediaUrls, status: "published",
    // Old dates keep fixtures out of new-update notifications. No publishing API
    // is called: no emails or real-organisation activity timestamps are changed.
    createdAt: `2001-01-0${i + 1}T00:00:00.000Z`, likes: 0,
  }, server);
  f.adminToken = (await load("admin-auth")).getAdminTokenValue();
  f.orgAccessToken = (await load("admin-organisation-access")).createOrganisationAccess(f.orgId);
  f.testImagePath = "/tmp/rootprojx-editor-cover.jpg";
  f.testVideoPath = "/tmp/rootprojx-editor-video.mp4";
  await writeFile(path, JSON.stringify(f), { mode: 0o600 });
  await run("magick", ["-size", "1200x1500", "xc:#B3121B", f.testImagePath]);
  await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=#B3121B:s=1080x1350:r=5:d=2",
    "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", f.testVideoPath]);
  await writeFile(path, JSON.stringify(f), { mode: 0o600 });
  console.log("Prepared one isolated supporter, four supporter posts, two temporary organisation posts, and private browser-test credentials.");
  console.log(`Fixture: ${path}`);
}
