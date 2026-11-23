import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const b = await build({ entryPoints: [new URL("./post-management.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "esm", packages: "external" });
const { createPostManagement } = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0]!.text).toString("base64")}`);
function fixture() {
  const docs = new Map<string, any>([
    ["users/a", { accountType: "supporter", name: "A", profileShowcase: { bookmarks: ["keep"], settings: { preserve: true } } }],
    ["users/org", { accountType: "organisation", name: "Owner", approvalStatus: "approved" }],
    ["organisations/org", { name: "Humanity Ova Vanity", verified: true }],
  ]);
  for (let n = 1; n <= 4; n++) docs.set(`supporter_posts/p${n}`, { id: `p${n}`, author_id: "a", caption: `Caption ${n}`, media_ids: [], created_at: `2026-11-2${n}` });
  docs.set("updates/u", { _id: "u", orgId: "org", content: "Organisation post", mediaUrls: ["/api/video.mp4"] });
  const store = {
    get: async (c: string, id: string) => docs.get(`${c}/${id}`) ?? null,
    put: async (c: string, id: string, patch: any) => { docs.set(`${c}/${id}`, { ...docs.get(`${c}/${id}`), ...patch }); },
    query: async (c: string) => [...docs.entries()].filter(([key]) => key.startsWith(c + "/")).map(([, d]) => d),
    mutate: async (uid: string, _t: string, decide: any) => { const u = docs.get(`users/${uid}`); u.profileShowcase = decide(structuredClone(u)); },
  };
  return { docs, service: createPostManagement(store) };
}
const status = (code: number) => (e: any) => e.status === code;
test("covers must be inspected photos owned by this author and remain bound to this post", async () => {
  const f = fixture();
  const good = { id: "cover", author_id: "org", type: "photo", state: "ready", post_id: null,
    width: 1080, height: 1350, url: "/api/supporter-posts/media/cover" };
  for (const bad of [{ ...good, author_id: "a" }, { ...good, state: "pending" }, { ...good, width: undefined },
    { ...good, width: 1079 }, { ...good, height: 1000 }, { ...good, type: "video" }, { ...good, post_id: "another" }]) {
    f.docs.set("supporter_post_media/cover", bad);
    await assert.rejects(f.service.change("update", "u", "org", { coverMediaId: "cover" }, "t"), status(400));
  }
  f.docs.set("supporter_post_media/cover", good);
  await f.service.change("update", "u", "org", { coverMediaId: "cover" }, "t");
  assert.equal(f.docs.get("updates/u").coverUrl, "/api/supporter-posts/media/cover");
  assert.equal(f.docs.get("supporter_post_media/cover").post_kind, "update");
  assert.equal(f.docs.get("supporter_post_media/cover").post_id, "u");
  assert.deepEqual(f.docs.get("updates/u").mediaUrls, ["/api/video.mp4"]);
  await f.service.change("update", "u", "org", { coverMediaId: "cover" }, "t"); // Attachment retry.
  f.docs.get("updates/u").mediaUrls = ["/api/photo.jpg"];
  await assert.rejects(f.service.change("update", "u", "org", { coverMediaId: "cover" }, "t"), status(400));
});
test("management belongs to the source author, never the caller's selected organisation or claimed role", async () => {
  const f = fixture();
  assert.equal((await f.service.details("update", "u", "org", "t")).author.verified, true);
  for (const [kind, id, uid] of [["update", "u", "a"], ["post", "p1", "org"]])
    await assert.rejects(f.service.change(kind, id, uid, { status: "deleted" }, "t"), status(403));
  await assert.rejects(f.service.details("update", "../u", "org", "t"), status(400));
});
test("three pins maximum, unpin frees a slot and unrelated account fields are preserved", async () => {
  const f = fixture();
  for (const id of ["p1", "p2", "p3"]) assert.equal((await f.service.change("post", id, "a", { pinned: true }, "t")).pinned, true);
  await assert.rejects(f.service.change("post", "p4", "a", { pinned: true }, "t"), status(409));
  await f.service.change("post", "p2", "a", { pinned: false }, "t");
  await f.service.change("post", "p4", "a", { pinned: true }, "t");
  const showcase = f.docs.get("users/a").profileShowcase;
  assert.equal(showcase.pinnedPosts.length, 3); assert.deepEqual(showcase.bookmarks, ["keep"]); assert.equal(showcase.settings.preserve, true);
});
test("comment controls persist and archive preserves the post and its interactions", async () => {
  const f = fixture();
  f.docs.set("post_interactions/like", { postKey: "post:p1", type: "like" });
  await f.service.change("post", "p1", "a", { commentsDisabled: true, pinned: true }, "t");
  await f.service.change("post", "p1", "a", { status: "archived" }, "t");
  const archived = await f.service.archived("a", "t");
  assert.equal(archived.length, 1); assert.equal(archived[0].id, "p1"); assert.equal(archived[0].pinned, false);
  assert.equal(archived[0].commentsDisabled, true);
  assert.equal(f.docs.get("supporter_posts/p1").caption, "Caption 1"); assert.ok(f.docs.has("post_interactions/like"));
  assert.equal((await f.service.archived("org", "t")).length, 0);
  await f.service.change("post", "p1", "a", { status: "published" }, "t");
  assert.equal((await f.service.archived("a", "t")).length, 0);
});
test("deleted posts cannot be restored through management", async () => {
  const f = fixture();
  assert.equal((await f.service.change("post", "p1", "a", { status: "deleted" }, "t")).status, "deleted");
  await assert.rejects(f.service.change("post", "p1", "a", { status: "published" }, "t"), status(404));
  assert.equal(f.docs.get("supporter_posts/p2").removed, undefined);
});

test("caption/community settings persist without replacing media, and foreign campaigns are rejected", async () => {
  const f = fixture();
  f.docs.get("organisations/org").campaigns = [{ _id: "own", name: "Own campaign" }];
  const before = structuredClone(f.docs.get("updates/u").mediaUrls);
  const saved = await f.service.change("update", "u", "org", {
    caption: "Edited caption", communityTag: "Education", campaignId: "own",
    commentsDisabled: true, hideLikeCount: true,
  }, "t");
  assert.equal(saved.caption, "Edited caption"); assert.equal(saved.campaignId, "own");
  assert.equal(saved.communityTag, "Education"); assert.equal(saved.hideLikeCount, true);
  assert.ok(saved.editedAt); assert.deepEqual(f.docs.get("updates/u").mediaUrls, before);
  await assert.rejects(f.service.change("update", "u", "org", { campaignId: "another-org" }, "t"), status(400));
  await assert.rejects(f.service.change("post", "p1", "a", { campaignId: "own" }, "t"), status(400));
  await assert.rejects(f.service.change("post", "p1", "a", { caption: "a".repeat(2201) }, "t"), status(400));
});
