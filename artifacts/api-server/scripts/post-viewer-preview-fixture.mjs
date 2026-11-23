// Isolated Preview test data. No welcome emails, real-organisation edits or
// uploaded file copies. Credentials stay in a mode-0600 temporary file.
import { build } from "esbuild";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
const path = process.argv[3] || "/tmp/rootprojx-post-viewer-fixture.json";
const bundled = await build({ entryPoints: [new URL("../src/lib/firebase-rest.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "esm", packages: "external" });
const db = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const server = await db.getServerToken();
if (process.argv[2] === "repair") {
  const f = JSON.parse(await readFile(path, "utf8"));
  for (const p of f.posts) for (const id of p.mediaIds)
    await db.fsPatch("supporter_post_media", id, { filter: "original" }, server);
  const r = await fetch(`https://${process.env.REPLIT_DEV_DOMAIN}/api/supporter-showcase/me`, { headers: { Authorization: `Bearer ${f.token}` } });
  console.log(`Isolated profile fixture: HTTP ${r.status}`);
  if (!r.ok) process.exitCode = 1;
} else if (process.argv[2] === "cleanup") {
  const f = JSON.parse(await readFile(path, "utf8"));
  const interactions = await db.fsQuery("post_interactions", [{ field: "uid", op: "EQUAL", value: f.uid }], server);
  for (const row of interactions) await db.fsDelete("post_interactions", row._id, server);
  for (const p of f.posts) {
    for (const id of p.mediaIds) await db.fsPatch("supporter_post_media", id, { status: "discarded", url: null }, server);
    await db.fsPatch("supporter_posts", p.id, { removed: true, removed_at: new Date().toISOString() }, server);
  }
  // Existing rules deliberately forbid deleting user/post documents, including
  // for the API identity. Keep that protection and leave only private tombstones.
  await db.fsPatch("users", f.uid, { name: "Removed Preview test account", email: null, deleted: true,
    publicProfile: { enabled: false, displayName: "", bio: "", publicId: null } }, server);
  await db.fsDelete("supporters", f.uid, server);
  // Firebase requires a recent sign-in for login deletion, not merely an
  // unexpired token. Keep only generated test credentials in the private file.
  const fresh = f.email && f.password ? await db.firebaseSignIn(f.email, f.password) : null;
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${process.env.FIREBASE_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: fresh?.idToken ?? f.token }),
  });
  if (!result.ok) {
    const error = await result.json();
    if (error.error?.message !== "CREDENTIAL_TOO_OLD_LOGIN_AGAIN") throw new Error("Test login deletion failed");
    process.stdout.write("The original fixture's Firebase login was retained because it needs recent sign-in; its private app record is marked removed.\n");
  }
  await unlink(path);
  process.stdout.write("Cleared Preview interactions and bookmarks and hid test posts; existing document-retention rules were preserved.\n");
} else {
  try { await readFile(path); throw new Error("An existing fixture must be cleaned up before creating another."); }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  const uidSuffix = randomUUID().slice(0, 8);
  const email = `post-viewer-${uidSuffix}@example.invalid`;
  const password = `${randomUUID()}!aA7`;
  const auth = await db.firebaseSignUp(email, password);
  const name = `Preview viewer check ${uidSuffix}`;
  const now = Date.now();
  await db.fsPatch("users", auth.uid, { email, name, accountType: "supporter", avatarInitials: "PV",
    createdAt: new Date(now).toISOString(), publicProfile: { enabled: false, displayName: name, bio: "", publicId: null } }, server);
  const orgPostId = "rermslN0lUWcaLwudFmz";
  const real = await db.fsGet("updates", orgPostId, server);
  const org = await db.fsGet("organisations", "wjrO1hiK6gfS7og1KVSjs5euRlC2", server);
  const video = real.mediaUrls.find(u => /\.(mp4|mov|webm)(?:[?#]|$)/i.test(u));
  if (!video || !org.coverImage) throw new Error("Real public test media unavailable");
  const posts = [];
  for (const [i, type] of ["video", "photo", "text"].entries()) {
    const id = randomUUID(), mediaIds = type === "text" ? [] : [randomUUID()];
    await db.fsPatch("supporter_posts", id, { id, author_id: auth.uid, type, caption: `Isolated Preview ${type} post`,
      community_tag: null, organisation_id: null, campaign_id: null, media_ids: mediaIds, removed: false,
      created_at: new Date(now - i * 1000).toISOString(), edited_at: null }, server);
    if (mediaIds.length) await db.fsPatch("supporter_post_media", mediaIds[0], {
      id: mediaIds[0], post_id: id, author_id: auth.uid, type, url: type === "video" ? video : org.coverImage,
      order: 0, crop: { aspect: "original", zoom: 1, x: 0, y: 0 }, filter: "original",
      adjustments: { brightness: 1, contrast: 1, saturation: 1 }, width: type === "video" ? 1080 : 1600,
      height: type === "video" ? 1920 : 600, status: "attached", video_thumbnail_url: null,
    }, server);
    posts.push({ id, type, mediaIds });
  }
  await writeFile(path, JSON.stringify({ uid: auth.uid, token: auth.idToken, email, password, name, posts, orgPostId }), { mode: 0o600 });
  process.stdout.write(JSON.stringify({ fixturePath: path, uid: auth.uid, posts: posts.map(({ id, type }) => ({ id, type })), orgPostId }) + "\n");
}
