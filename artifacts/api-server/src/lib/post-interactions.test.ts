import test from "node:test";
import assert from "node:assert/strict";
import type { InteractionStore } from "./post-interactions.ts";
import { build } from "esbuild";
const bundled = await build({
  entryPoints: [new URL("./post-interactions.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "esm", packages: "external",
});
const { createPostInteractions, INTERACTIONS } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0]!.text).toString("base64")}`) as typeof import("./post-interactions.ts");

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  const docs = new Map<string, Record<string, any>>();
  const set = (c: string, id: string, d: Record<string, any>) => { docs.set(`${c}/${id}`, structuredClone(d)); };
  set("users", "alice", { accountType: "supporter", name: "Alice", publicProfile: { enabled: true, publicId: "alice" } });
  set("users", "bob", { accountType: "supporter", name: "Bob", publicProfile: { enabled: true, publicId: "bob" } });
  set("users", "org", { accountType: "organisation", approvalStatus: "approved" });
  set("organisations", "org", { name: "Real organisation", verified: true, logo: "/api/logo.jpg" });
  set("updates", "update", { orgId: "org", status: "published", title: "Our work", content: "On the ground", mediaUrls: ["/api/film.mp4", "/api/photo.jpg"], createdAt: "2026-11-23T12:00:00.000Z", likes: 0 });
  set("updates", "other", { orgId: "org", content: "Other", createdAt: "2026-11-23T12:00:00.000Z" });
  set("supporter_posts", "post", { id: "post", author_id: "alice", caption: "My photo", type: "photo", media_ids: ["media"], created_at: "2026-11-23T12:00:00.000Z" });
  set("supporter_post_media", "media", { id: "media", post_id: "post", author_id: "alice", type: "photo", url: "/api/private.jpg", order: 0, crop: { zoom: 1 } });
  const store: InteractionStore = {
    get: async (c, id) => docs.get(`${c}/${id}`) ?? null,
    put: async (c, id, d) => { set(c, id, d); },
    create: async (c, id, d) => { if (docs.has(`${c}/${id}`)) return false; set(c, id, d); return true; },
    remove: async (c, id) => { docs.delete(`${c}/${id}`); },
    query: async key => [...docs.entries()].filter(([k, v]) => k.startsWith(`${INTERACTIONS}/`) && v.postKey === key).map(([, v]) => v),
  };
  return { service: createPostInteractions(store), docs, set };
}
const status = (code: number) => (error: any) => error.status === code;

test("viewer resolves published organisation media in order and authoritative author", async () => {
  const { service } = fixture();
  const { record } = await service.visible("update", "update", null, "t");
  assert.equal(record.author.name, "Real organisation");
  assert.equal(record.author.verified, true);
  assert.deepEqual(record.media.map(m => m.type), ["video", "photo"]);
});

test("likes persist across service instances, are idempotent and unlike only the current actor", async () => {
  const f = fixture();
  assert.equal((await f.service.like("update", "update", "alice", true, "t")).likes, 1);
  assert.equal((await f.service.like("update", "update", "alice", true, "t")).likes, 1);
  await f.service.like("update", "update", "bob", true, "t");
  const after = await f.service.like("update", "update", "alice", false, "t");
  assert.equal(after.likes, 1); assert.equal(after.liked, false);
  assert.equal((await f.service.activity("update", "update", "bob", "t")).liked, true);
});

test("new organisation reactions carry trusted identity, recipient and immutable event time", async () => {
  const f = fixture();
  await f.service.like("post", "post", "org", true, "t");
  const first = [...f.docs.values()].find(r => r.type === "like")!;
  assert.equal(first.recipientId, "alice");
  assert.equal(first.author.name, "Real organisation");
  assert.equal(first.author.verified, true);
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
  await f.service.like("post", "post", "org", true, "t");
  assert.deepEqual([...f.docs.values()].find(r => r.type === "like"), first);
  await f.service.comment("post", "post", "org", { clientId: uuid(91), text: "An organisation reply" }, "t");
  const comment = [...f.docs.values()].find(r => r.type === "comment")!;
  assert.equal(comment.recipientId, "alice");
  assert.equal(comment.author.id, "org");
  assert.equal(comment.author.verified, true);
});

test("commenting and hidden-like preferences are enforced on the server, with counts retained for the owner", async () => {
  const f = fixture();
  await f.service.like("update", "update", "alice", true, "t");
  Object.assign(f.docs.get("updates/update")!, { hideLikeCount: true, commentsDisabled: true });
  const guest = await f.service.activity("update", "update", null, "t");
  assert.equal(guest.likesHidden, true); assert.equal(guest.likes, 0); assert.equal(guest.commentsDisabled, true);
  const owner = await f.service.activity("update", "update", "org", "t");
  assert.equal(owner.likesHidden, false); assert.equal(owner.likes, 1);
  await assert.rejects(f.service.comment("update", "update", "alice", { clientId: uuid(92), text: "Not allowed" }, "t"), status(403));
  assert.equal((await f.service.activity("update", "update", "org", "t")).commentCount, 0);
});

test("comment retry is idempotent, trims text and cannot overwrite the first payload", async () => {
  const { service } = fixture(), input = { clientId: uuid(1), text: " Hello " };
  const a = await service.comment("update", "update", "alice", input, "t");
  const b = await service.comment("update", "update", "alice", input, "t");
  assert.equal(a.commentCount, 1); assert.deepEqual(a, b); assert.equal(a.comments[0]!.text, "Hello");
  await assert.rejects(service.comment("update", "update", "alice", { ...input, text: "Replace" }, "t"), status(409));
});

test("replies and comment hearts use real parent IDs and organisation replies show their tick", async () => {
  const { service } = fixture();
  const a = await service.comment("update", "update", "alice", { clientId: uuid(1), text: "Can I help?" }, "t");
  const parentId = a.comments[0]!.id;
  const b = await service.comment("update", "update", "org", { clientId: uuid(2), text: "Yes", parentId }, "t");
  assert.equal(b.comments[1]!.author.verified, true);
  assert.equal(b.comments[1]!.parentId, parentId);
  const c = await service.like("update", "update", "bob", true, "t", parentId);
  assert.equal(c.comments[0]!.likes, 1); assert.equal(c.comments[0]!.liked, true);
  await service.like("update", "update", "bob", true, "t", parentId);
  assert.equal((await service.activity("update", "update", null, "t")).comments[0]!.likes, 1);
  await assert.rejects(service.like("update", "other", "bob", true, "t", parentId), status(404));
  await assert.rejects(service.comment("update", "other", "bob", { clientId: uuid(3), text: "cross post", parentId }, "t"), status(404));
});

test("private supporter posts, comments and interactions stay owner-only even for followers", async () => {
  const f = fixture();
  f.docs.get("users/alice")!.publicProfile.enabled = false;
  assert.equal((await f.service.visible("post", "post", "alice", "t")).record.media.length, 1);
  await f.service.comment("post", "post", "alice", { clientId: uuid(1), text: "Private note" }, "t");
  for (const uid of [null, "bob", "org"]) {
    await assert.rejects(f.service.visible("post", "post", uid, "t"), status(404));
    await assert.rejects(f.service.activity("post", "post", uid, "t"), status(404));
  }
  await assert.rejects(f.service.like("post", "post", "bob", true, "t"), status(404));
  await assert.rejects(f.service.comment("post", "post", "bob", { clientId: uuid(2), text: "No" }, "t"), status(404));
});

test("removing a post or making its author private hides existing reactions too", async () => {
  const f = fixture();
  await f.service.like("post", "post", "bob", true, "t");
  f.docs.get("users/alice")!.publicProfile.enabled = false;
  await assert.rejects(f.service.activity("post", "post", "bob", "t"), status(404));
  f.docs.get("supporter_posts/post")!.removed = true;
  await assert.rejects(f.service.visible("post", "post", "alice", "t"), status(404));
});

test("unpublished/deleted posts stay hidden and archived posts are visible only to their owner", async () => {
  for (const state of ["draft", "archived", "deleted"]) {
    const f = fixture(); f.docs.get("updates/update")!.status = state;
    if (state === "archived") assert.equal((await f.service.visible("update", "update", "org", "t")).record.isOwner, true);
    else await assert.rejects(f.service.visible("update", "update", "org", "t"), status(404));
    await assert.rejects(f.service.like("update", "update", "alice", true, "t"), status(404));
  }
  const f = fixture(); f.docs.get("organisations/org")!.deletedAt = "2026-11-23";
  await assert.rejects(f.service.visible("update", "update", null, "t"), status(404));
});

test("rejects invalid targets, missing accounts, blank/oversized comments and unrelated media", async () => {
  const f = fixture();
  await assert.rejects(f.service.visible("post", "../users", null, "t"), status(400));
  await assert.rejects(f.service.like("update", "update", "missing", true, "t"), status(403));
  for (const text of ["  ", "x".repeat(2001)]) await assert.rejects(f.service.comment("update", "update", "alice", { clientId: uuid(1), text }, "t"), status(400));
  f.docs.get("supporter_post_media/media")!.author_id = "bob";
  await assert.rejects(f.service.visible("post", "post", "alice", "t"), status(503));
});

test("guest activity exposes no reacting account IDs or private account metadata", async () => {
  const f = fixture();
  await f.service.like("update", "update", "alice", true, "t");
  const dto = await f.service.activity("update", "update", null, "t");
  assert.deepEqual(dto, { likes: 1, liked: false, commentCount: 0, comments: [], likesHidden: false, commentsDisabled: false });
  assert.doesNotMatch(JSON.stringify(dto), /uid|email|alice/);
});

test("concurrent comments use independent records and concurrent retries cannot duplicate a comment", async () => {
  const f = fixture();
  await Promise.all(Array.from({ length: 20 }, (_, n) =>
    f.service.comment("update", "update", "alice", { clientId: uuid(n), text: `Comment ${n}` }, "t")));
  assert.equal((await f.service.activity("update", "update", "alice", "t")).commentCount, 20);
  await Promise.all(Array.from({ length: 8 }, () =>
    f.service.comment("update", "update", "bob", { clientId: uuid(99), text: "A retried comment" }, "t")));
  assert.equal((await f.service.activity("update", "update", "alice", "t")).commentCount, 21);
});
