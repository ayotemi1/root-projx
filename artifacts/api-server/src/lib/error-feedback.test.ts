import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";

async function client(path = "error-feedback") {
  const built = await build({ entryPoints: [new URL(`../../../web/src/lib/${path}.ts`, import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs" });
  const m = { exports: {} as any };
  new Function("module", "exports", built.outputFiles[0]!.text)(m, m.exports);
  return m.exports;
}

test("errors explain network uncertainty, session, permissions, limits, formats, rate limits and service failure", async () => {
  const { userErrorMessage: message } = await client();
  for (const raw of ["Failed to fetch", "Load failed", "NetworkError", "Network request failed"]) {
    const result = message(new TypeError(raw), "publish this post");
    assert.match(result, /connection|connect/);
    assert.match(result, /try again/);
    assert.doesNotMatch(result, /Failed to fetch|NetworkError/);
  }
  for (const [status, pattern] of [[401, /sign.in|Sign in/], [403, /permission/], [404, /dashboard/],
    [413, /500 MB.*20 MB/], [415, /MP4/], [429, /Wait a minute/], [503, /Try again shortly/]] as const)
    assert.match(message({ message: "", status }), pattern);
  assert.match(message({ message: "", status: 401 }, "sign in"), /Forgot password/);
  assert.match(message(new Error("Failed to fetch"), "start checkout"), /history before trying again/);
  assert.match(message(new Error("Timeout"), "confirm this payout"), /history before trying again/);
  assert.match(message(new Error("Minimum donation is £3.")), /£3/);
  assert.doesNotMatch(message(new Error("Firestore permission_denied sk_live_sensitive")), /Firestore|sk_live/);
});

test("fetch boundary explains connection failures and preserves intentional aborts without retrying writes", async () => {
  const { appFetch } = await client();
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; throw new TypeError("Failed to fetch"); };
    await assert.rejects(appFetch("/api/uploads/video/request", { method: "POST" }), /upload this file.*connection|connect.*upload this file/i);
    assert.equal(calls, 1);
    globalThis.fetch = async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); };
    await assert.rejects(appFetch("/api/auth/me"), { name: "AbortError" });
  } finally { globalThis.fetch = original; }
});

test("post videos use direct storage, not multipart; failure to confirm never returns an asset URL", async () => {
  const { uploadMedia } = await client("api");
  const originalFetch = globalThis.fetch;
  const browserGlobals = globalThis as typeof globalThis & { XMLHttpRequest?: unknown };
  const originalXHR = browserGlobals.XMLHttpRequest;
  const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
  let completeFails = false;
  class XHR {
    status = 200; upload = {}; onload!: () => void;
    open(method: string, path: string) { calls.push({ path, method }); }
    setRequestHeader(key: string) { assert.notEqual(key, "Authorization"); }
    send(body: Blob) { assert.equal(body.type, "video/mp4"); this.onload(); }
  }
  try {
    browserGlobals.XMLHttpRequest = XHR;
    globalThis.fetch = async (input, options) => {
      const path = String(input);
      calls.push({ path, method: options?.method, body: options?.body });
      if (path.endsWith("/request")) return Response.json({ uploadUrl: "https://storage.example.test/upload", objectPath: "pending" });
      if (completeFails) throw new TypeError("Failed to fetch");
      return Response.json({ url: "/api/uploads/object/confirmed" });
    };
    const video = new File(["video"], "clip.mp4", { type: "video/mp4" });
    assert.deepEqual(await uploadMedia([video], "synthetic"), ["/api/uploads/object/confirmed"]);
    assert.equal(calls[0]!.path, "/api/uploads/video/request");
    assert.equal(calls[1]!.method, "PUT");
    assert.equal(calls[2]!.path, "/api/uploads/video/complete");
    assert.ok(calls.every(call => !call.path.includes("/uploads/media")));
    completeFails = true;
    await assert.rejects(uploadMedia([video], "synthetic"), /connect/);
  } finally { globalThis.fetch = originalFetch; browserGlobals.XMLHttpRequest = originalXHR; }
});

test("all website fetch call sites use the friendly network boundary", async () => {
  const root = new URL("../../../web/src/", import.meta.url);
  async function walk(dir: URL): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) await walk(path);
      else if (/\.tsx?$/.test(entry.name) && entry.name !== "error-feedback.ts") {
        const source = await readFile(path, "utf8");
        if (/\bfetch\(/.test(source)) assert.match(source, /appFetch as fetch/, `Unexplained network errors can escape ${path.pathname}`);
      }
    }
  }
  await walk(root);
});
