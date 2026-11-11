import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function feedback() {
  const result = await build({
    entryPoints: [new URL("../../../web/src/lib/upload-feedback.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs",
  });
  const module = { exports: {} as any };
  new Function("module", "exports", result.outputFiles[0]!.text)(module, module.exports);
  return module.exports;
}

test("video size feedback states actual size, limit and an actionable alternative", async () => {
  const f = await feedback();
  const problem = f.videoFileProblem({ size: 650 * 1024 * 1024, type: "video/mp4" });
  assert.match(problem.message, /650 MB/);
  assert.match(problem.message, /maximum is 500 MB/);
  assert.match(problem.message, /720p/);
  assert.match(problem.message, /YouTube\/Vimeo/);
  assert.equal(problem.retryable, false);
  assert.equal(f.videoFileProblem({ size: f.MAX_VIDEO_BYTES, type: "video/mp4" }), null);
  assert.equal(f.formatUploadSize(f.MAX_VIDEO_BYTES + 1), "500.1 MB");
  assert.equal(f.videoFileProblem({ size: 0, type: "video/mp4" }).retryable, false);
  assert.equal(f.videoFileProblem({ size: 100, type: "application/pdf" }).retryable, false);
});

test("raw upload status codes become plain-language explanations", async () => {
  const f = await feedback();
  const large = f.uploadFeedback(new Error("Upload failed (413)"), "video", 25 * 1024 * 1024);
  assert.match(large.message, /25 MB/);
  assert.match(large.message, /500 MB/);
  assert.match(large.message, /older uploader/);
  assert.doesNotMatch(large.message, /413/);
  assert.equal(large.retryable, false);
  assert.match(f.uploadFeedback(Object.assign(new Error("Unauthorized"), { status: 401 }), "video").message, /sign-in session has expired/);
  assert.match(f.uploadFeedback(new Error("Upload failed (503)"), "video").message, /temporarily unavailable/);
  assert.equal(f.uploadFeedback(new Error("Upload failed (503)"), "video").retryable, true);
  assert.match(f.uploadFeedback(new Error("Failed to fetch"), "video").message, /connection was interrupted/);
  assert.match(f.uploadFeedback(new Error("Upload timed out"), "video").message, /took too long/);
  const permission = Object.assign(new Error("Upload failed (403)"), { status: 403, stage: "storage" });
  assert.equal(f.uploadFeedback(permission, "video").retryable, true);
  assert.equal(f.uploadFeedback(new Error("Upload failed (403)"), "video").retryable, false);
});
