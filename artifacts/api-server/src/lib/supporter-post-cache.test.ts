import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("confirmed posts immediately update only the owner's lists and survive an older in-flight response without duplicates", async () => {
  const result = await build({
    entryPoints: [new URL("../../../web/src/lib/supporter-post-cache.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const webRequire = createRequire(new URL("../../../web/package.json", import.meta.url));
  const { QueryClient } = webRequire("@tanstack/react-query");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const root = mod.exports.SP_KEY;
  const token = "synthetic-owner-token";
  const keys = ["mine", "following", "for-you"].map(feed => [root, feed, null, token]);
  for (const key of keys) qc.setQueryData(key, []);
  const otherAccount = [root, "mine", null, "another-owner"];
  const otherProfile = [root, null, "someone-else-public-profile", token];
  qc.setQueryData(otherAccount, []);
  qc.setQueryData(otherProfile, []);
  let release!: (rows: unknown[]) => void;
  const earlierRead = qc.fetchQuery({ queryKey: keys[2], queryFn: () => new Promise(resolve => { release = resolve; }) }).catch(() => null);
  await Promise.resolve();
  const post = { id: "confirmed", created_at: "2026-11-21T12:00:00Z", type: "text", caption: "Just posted" };
  await mod.exports.cachePublishedPost(qc, post, token);
  release([]);
  await earlierRead;
  await mod.exports.cachePublishedPost(qc, post, token);
  for (const key of keys) assert.deepEqual(qc.getQueryData(key), [post]);
  assert.deepEqual(qc.getQueryData(otherAccount), [], "must not put this account's private post into another account's cache");
  assert.deepEqual(qc.getQueryData(otherProfile), [], "must not put an author into another public profile");
  qc.clear();
});
