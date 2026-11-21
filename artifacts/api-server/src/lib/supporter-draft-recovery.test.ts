import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

test("unavailable browser storage retains captions, edits, originals and upload references per account in the same tab", async () => {
  const result = await build({
    entryPoints: [new URL("../../../web/src/lib/supporter-post-drafts.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const store = mod.exports;
  const draft = {
    userKey: "supporter:one", postId: "stable-draft", caption: "Keep this caption",
    communityTag: "Education", organisationId: null, campaignId: null, savedAt: Date.now(),
    items: [{ id: "one", file: new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
      edit: { filter: "warm" }, objectPath: "already-uploaded", media: { id: "media-one", url: "/private-media/one" } }],
  };
  assert.equal(await store.saveDraft(draft), false, "must not claim durable storage when IndexedDB is unavailable");
  const recovered = await store.loadDraft("supporter:one");
  assert.equal(recovered.caption, draft.caption);
  assert.equal(recovered.items[0].file.name, "photo.jpg");
  assert.equal(recovered.items[0].objectPath, "already-uploaded");
  assert.equal(recovered.items[0].media.id, "media-one");
  assert.equal(recovered.items[0].edit.filter, "warm");
  assert.equal(await store.loadDraft("supporter:two"), null, "another account cannot inherit this draft");
  await store.clearDraft("supporter:one");
  assert.equal(await store.loadDraft("supporter:one"), null);
});
