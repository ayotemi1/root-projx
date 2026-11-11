import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

async function fixture() {
  const state = { signed: [] as any[], files: new Map<string, any>(), moves: 0 };
  const result = await build({
    entryPoints: [new URL("./video-uploads.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    define: { "process.env.PRIVATE_OBJECT_DIR": '"/synthetic-bucket/private"' },
    plugins: [{
      name: "storage-mock", setup(build) {
        build.onResolve({ filter: /\/objectStorage\.js$/ }, () => ({ path: "storage", namespace: "mock" }));
        build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          contents: `
            export async function signObjectURL(options) { state.signed.push(options); return "https://storage.example.test/signed"; }
            export const objectStorageClient = {bucket() {return {file(path) {return {
              path, async getMetadata() {
                if (!state.files.has(path)) throw Object.assign(new Error("Missing"), {code:404});
                return [state.files.get(path)];
              },
              async move(target) {state.moves++;state.files.set(target.path,state.files.get(path));state.files.delete(path);}
            };}};}};
          `, loader: "js",
        }));
      },
    }],
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", "state", result.outputFiles[0]!.text)(
    createRequire(import.meta.url), module, module.exports, state,
  );
  return { state, ...module.exports };
}

test("large videos receive an owner-scoped direct upload URL without application multipart", async () => {
  const f = await fixture();
  const target = await f.requestVideoUpload("org-one", {
    name: "../../phone video.mov", size: 100 * 1024 * 1024, contentType: "video/quicktime",
  });
  assert.match(target.objectPath, /^org-media-pending\/org-one\/[a-f0-9-]+\/phone_video\.mov$/);
  assert.equal(f.state.signed[0].method, "PUT");
  assert.equal(f.state.signed[0].ttlSec, 3600);
  assert.equal(f.state.signed[0].objectName, target.objectPath);
  assert.equal(f.state.files.size, 0);
  for (const invalid of [
    { name: "a.exe", size: 100, contentType: "application/x-msdownload" },
    { name: "a.mp4", size: 0, contentType: "video/mp4" },
    { name: "a.mp4", size: 1.5, contentType: "video/mp4" },
  ]) await assert.rejects(() => f.requestVideoUpload("org-one", invalid), { status: 400 });
  await assert.rejects(() => f.requestVideoUpload("org-one", {
    name: "large.mp4", size: f.MAX_VIDEO_BYTES + 1, contentType: "video/mp4",
  }), { status: 413 });
});

test("completion checks actual storage size/type, ownership and returns a stable asset on replay", async () => {
  const f = await fixture();
  const target = await f.requestVideoUpload("org-one", { name: "video.mp4", size: 1, contentType: "video/mp4" });
  await assert.rejects(() => f.completeVideoUpload("another-org", target.objectPath), { status: 403 });
  await assert.rejects(() => f.completeVideoUpload("org-one", "org-media-pending/org-one/../secret"), { status: 403 });
  await assert.rejects(() => f.completeVideoUpload("org-one", target.objectPath), { status: 400 });
  f.state.files.set(target.objectPath, { size: f.MAX_VIDEO_BYTES + 1, contentType: "video/mp4" });
  await assert.rejects(() => f.completeVideoUpload("org-one", target.objectPath), { status: 413 });
  f.state.files.set(target.objectPath, { size: 10, contentType: "text/html" });
  await assert.rejects(() => f.completeVideoUpload("org-one", target.objectPath), { status: 400 });
  assert.equal(f.state.moves, 0);
  f.state.files.set(target.objectPath, { size: 100 * 1024 * 1024, contentType: "video/mp4" });
  const path = await f.completeVideoUpload("org-one", target.objectPath);
  assert.match(path, /^org-media\/org-one\/videos\//);
  assert.equal(await f.completeVideoUpload("org-one", target.objectPath), path);
  assert.equal(f.state.moves, 1);
});

test("video client uploads bytes directly, keeps auth off storage, and waits for completion before returning", async () => {
  const result = await build({
    entryPoints: [new URL("../../../web/src/lib/video-upload.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs",
  });
  const calls: any[] = [];
  let completionFails = false;
  const fetchMock = async (url: string, options: any) => {
    calls.push({ url, options });
    return {
      ok: !completionFails || !url.endsWith("/complete"),
      json: async () => url.endsWith("/request")
        ? { uploadUrl: "https://storage.example.test/signed", objectPath: "pending-test" }
        : completionFails ? { error: "Could not finish saving" } : { url: "/api/uploads/object/verified-video" },
    };
  };
  class XHR {
    upload: any = {}; status = 200; timeout = 0; onload: any;
    headers: Record<string, string> = {};
    open(method: string, url: string) { calls.push({ method, url, headers: this.headers }); }
    setRequestHeader(key: string, value: string) { this.headers[key] = value; }
    send(body: Blob) { calls.push({ bytes: body.size }); this.upload.onprogress({ lengthComputable: true, loaded: body.size, total: body.size }); this.onload(); }
  }
  const module = { exports: {} as any };
  new Function("module", "exports", "fetch", "XMLHttpRequest", result.outputFiles[0]!.text)(
    module, module.exports, fetchMock, XHR,
  );
  const file = new File(["synthetic"], "phone.mp4", { type: "video/mp4" });
  const progress: number[] = [];
  assert.equal(await module.exports.uploadVideo(file, "synthetic-token", "/api", (n: number) => progress.push(n)), "/api/uploads/object/verified-video");
  assert.equal(calls[0].options.headers.Authorization, "Bearer synthetic-token");
  assert.equal(calls[1].method, "PUT");
  assert.deepEqual(calls[1].headers, { "Content-Type": "video/mp4" });
  assert.equal(calls[2].bytes, file.size);
  assert.match(calls[3].url, /\/complete$/);
  assert.equal(progress.length, 2);
  assert.ok(Math.abs(progress[0]! - 0.95) < 1e-10);
  assert.equal(progress[1], 1);
  completionFails = true;
  await assert.rejects(() => module.exports.uploadVideo(file, "synthetic-token", "/api"), /Could not finish saving/);
  const oversized = new File(["test"], "large.mp4", { type: "video/mp4" });
  Object.defineProperty(oversized, "size", { value: module.exports.MAX_VIDEO_BYTES + 1 });
  const before = calls.length;
  await assert.rejects(() => module.exports.uploadVideo(oversized, "synthetic-token", "/api"), /500 MB/);
  assert.equal(calls.length, before);
});
