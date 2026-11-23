import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
const compiled = await build({ entryPoints: [new URL("./post-interaction-notifications.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "esm", packages: "external" });
const { interactionNotifications } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.text).toString("base64")}`);

const author = { id: "hov", name: "Humanity Ova Vanity", avatarUrl: "/api/logo.jpg", verified: true };
const event = { id: "reaction1", postKey: "update:lifeyard", uid: "hov", recipientId: "life", author, type: "like", createdAt: "2026-11-23T10:00:00.000Z" };
const target = { record: { author: { id: "life" }, media: [] } };
test("like/comment alerts have real organisation names, stable IDs and viewer destinations", async () => {
  const deps = { query: async () => [event, { ...event, id: "comment1", type: "comment", text: "Great work." }], visible: async () => target };
  const first = await interactionNotifications("life", "t", new Set(), deps);
  assert.equal(first.length, 2);
  assert.equal(first[0].message, "Humanity Ova Vanity liked your post.");
  assert.equal(first[1].message, "Humanity Ova Vanity commented: Great work.");
  assert.equal(first[0].href, "/posts/lifeyard?kind=update");
  assert.equal(first[1].href, "/posts/lifeyard?kind=update&comments=1");
  const read = await interactionNotifications("life", "t", new Set([first[0].id]), deps);
  assert.equal(read[0].id, first[0].id); assert.equal(read[0].read, true); assert.equal(read[1].read, false);
});
test("self-reactions, other recipients, untimed historical likes and removed/private targets do not create alerts", async () => {
  const rows = [event, { ...event, uid: "life" }, { ...event, recipientId: "someone-else" },
    { ...event, createdAt: undefined }, { ...event, removed: true }, { ...event, type: "comment_like" }];
  const deps = { query: async () => rows, visible: async () => target };
  assert.equal((await interactionNotifications("life", "t", new Set(), deps)).length, 1);
  assert.equal((await interactionNotifications("life", "t", new Set(), { ...deps, visible: async () => { throw { status: 404 }; } })).length, 0);
  assert.equal((await interactionNotifications("life", "t", new Set(), { ...deps, visible: async () => ({ record: { author: { id: "other" }, media: [] } }) })).length, 0);
});
test("provider failure remains unknown, never a fabricated empty inbox", async () => {
  await assert.rejects(interactionNotifications("life", "t", new Set(), {
    query: async () => [event], visible: async () => { throw new Error("provider unavailable"); },
  }));
});
