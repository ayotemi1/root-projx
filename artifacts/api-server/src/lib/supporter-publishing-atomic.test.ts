import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

async function helpers() {
  const result = await build({
    entryPoints: [new URL("./firebase-rest.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  return mod.exports;
}
const fields = (author = "owner", post: string | null = null) => ({
  author_id: { stringValue: author }, state: { stringValue: "ready" },
  post_id: post ? { stringValue: post } : { nullValue: null }, objectPath: { stringValue: "pending" },
});

test("publication uses a single atomic commit with media revision and post create-only preconditions", async () => {
  const { fsPublishSupporterPost } = await helpers();
  const original = globalThis.fetch;
  const commits: any[] = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith(":commit")) {
      commits.push(JSON.parse(String(init!.body)));
      return new Response("{}", { status: 200 });
    }
    return Response.json({ fields: fields(), updateTime: "2026-11-21T20:00:00.123456Z" });
  };
  try {
    await fsPublishSupporterPost({ id: "post", author_id: "owner", caption: "caption" }, [{
      id: "media", order: 0, crop: { aspect: "1:1", zoom: 1, x: 0, y: 0 },
      filter: "original", adjustments: { brightness: 1, contrast: 1, saturation: 1 },
    }], "synthetic-server");
    assert.equal(commits.length, 1);
    assert.equal(commits[0].writes.length, 2);
    assert.deepEqual(commits[0].writes[0].currentDocument, { exists: false });
    assert.deepEqual(commits[0].writes[1].currentDocument, { updateTime: "2026-11-21T20:00:00.123456Z" });
    assert.ok(commits[0].writes[1].updateMask.fieldPaths.includes("post_id"));
    assert.ok(!commits[0].writes[1].updateMask.fieldPaths.includes("url"), "publication cannot replace an inspected asset URL");
    assert.equal(commits[0].writes[1].update.fields.post_id.stringValue, "post");
  } finally { globalThis.fetch = original; }
});

test("wrong-owner and already-claimed media never reach the atomic commit", async () => {
  const { fsPublishSupporterPost } = await helpers();
  const original = globalThis.fetch;
  let commits = 0;
  let row = fields("someone-else");
  globalThis.fetch = async (url) => {
    if (String(url).endsWith(":commit")) { commits++; return Response.json({}); }
    return Response.json({ fields: row, updateTime: "revision" });
  };
  try {
    const post = { id: "post", author_id: "owner" };
    await assert.rejects(() => fsPublishSupporterPost(post, [{ id: "media" }], "server"));
    row = fields("owner", "different-post");
    await assert.rejects(() => fsPublishSupporterPost(post, [{ id: "media" }], "server"));
    assert.equal(commits, 0);
  } finally { globalThis.fetch = original; }
});

test("completion retry cannot overwrite media which was already attached to a post", async () => {
  const { fsCompleteSupporterMedia } = await helpers();
  const original = globalThis.fetch;
  let patches = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "PATCH") patches++;
    return Response.json({ fields: fields("owner", "published-post"), updateTime: "new-revision" });
  };
  try {
    const result = await fsCompleteSupporterMedia("media", {
      author_id: "owner", objectPath: "pending", state: "ready", post_id: null,
    }, "server");
    assert.equal(result.post_id, "published-post");
    assert.equal(patches, 0);
  } finally { globalThis.fetch = original; }
});
