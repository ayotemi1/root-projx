import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

process.env.SESSION_SECRET = "media-session-unit-test-only";
const js = await build({
  stdin: { contents: 'export {setMediaSession,mediaViewer,canSeePost} from "./supporter-posts.ts";',
    resolveDir: new URL(".", import.meta.url).pathname },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
});
const mod = { exports: {} as any };
new Function("require", "module", "exports", js.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
const { setMediaSession, mediaViewer, canSeePost } = mod.exports;

test("verified sign-in can establish read-only media access before rendering supporter or organisation avatars", () => {
  for (const accountType of ["supporter", "organisation"]) {
    const issued: any[] = [];
    // Sign-in has no requireAuth middleware yet; its Firebase result is trusted.
    const req = { headers: {}, secure: true, get: () => "https" };
    const identity = { userId: `verified-${accountType}`, accountType };
    setMediaSession(req, { cookie: (...args: any[]) => issued.push(args) }, identity);
    assert.equal(issued.length, 1);
    const [name, value, options] = issued[0];
    assert.equal(options.path, "/api/supporter-posts/media");
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.partitioned, true);
    assert.equal(options.sameSite, "none");
    const viewer = mediaViewer({ headers: { cookie: `${name}=${value}` } });
    assert.equal(viewer, identity.userId);
    assert.equal(canSeePost({ author_id: "another-supporter", removed: false },
      { accountType: "supporter", publicProfile: { enabled: false } }, viewer), false);
    assert.equal(mediaViewer({ headers: { cookie: `${name}=${value}tampered` } }), null);
  }
});
test("a verified request identity overrides a stale media cookie from a different account", () => {
  let cookie = "";
  setMediaSession({ secure: true, headers: {}, get: () => "https", user: { userId: "old-supporter", accountType: "supporter" } },
    { cookie: (name: string, value: string) => { cookie = `${name}=${value}`; } });
  assert.equal(mediaViewer({ headers: { cookie }, user: { userId: "new-org", accountType: "organisation" } }), "new-org");
  let writes = 0;
  setMediaSession({ headers: {} }, { cookie: () => writes++ }, { userId: "unknown", accountType: "admin" });
  assert.equal(writes, 0);
});
