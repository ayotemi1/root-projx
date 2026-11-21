import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const media = await (async () => {
  const result = await build({
    entryPoints: [new URL("../../../web/src/lib/supporter-post-media.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs",
  });
  const mod = { exports: {} as Record<string, any> };
  new Function("module", "exports", result.outputFiles[0]!.text)(mod, mod.exports);
  return mod.exports;
})();

function file(name: string, type: string, size = 100) {
  return { name, type, size } as File;
}

test("supporter media picker accepts exactly the backend contract formats, with extension fallback", () => {
  for (const type of ["image/jpeg", "image/png", "image/heic", "image/heif"]) {
    assert.equal(media.postMediaKind(file("photo", type)), "image");
    assert.ok(media.POST_MEDIA_ACCEPT.includes(type));
  }
  for (const type of ["video/mp4", "video/quicktime"]) {
    assert.equal(media.postMediaKind(file("video", type)), "video");
    assert.ok(media.POST_MEDIA_ACCEPT.includes(type));
  }
  for (const type of ["image/gif", "image/webp", "video/webm"]) {
    assert.equal(media.postMediaKind(file("x", type)), null);
    assert.ok(!media.POST_MEDIA_ACCEPT.split(",").includes(type));
  }
  assert.equal(media.postContentType(file("IMG_1.HEIC", "")), "image/heic");
  assert.equal(media.postContentType(file("clip.mov", "")), "video/quicktime");
  assert.equal(media.postMediaKind(file("unknown.bin", "")), null);
  assert.match(media.POST_MEDIA_LIMITS_COPY, /10 minutes/);
});

test("video duration over 10 minutes is rejected with an actionable message", () => {
  assert.equal(media.videoDurationError("a.mp4", 600), null);
  assert.match(media.videoDurationError("a.mp4", 601), /a.mp4.*10 minutes.*Trim/);
});

test("edits are clamped to the contract ranges", () => {
  const e = media.normaliseEdit({ crop: { aspect: "9:16", zoom: 9, x: -80, y: 80 }, filter: "sepia", adjustments: { brightness: 3, contrast: 0, saturation: -1 } });
  assert.deepEqual(e, { crop: { aspect: "original", zoom: 3, x: -50, y: 50 }, filter: "original", adjustments: { brightness: 1.5, contrast: 0.5, saturation: 0 } });
});

test("selection retains File references and order for a single swipeable draft", () => {
  const inputs = [file("first.png", "image/png"), file("second.mp4", "video/mp4"), file("third.jpg", "image/jpeg")];
  const result = media.selectPostMedia(inputs, 0);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.accepted, inputs);
  assert.equal(result.accepted[1], inputs[1], "keep the actual File, not a name or a fake uploaded URL");
  assert.equal(inputs.length, 3, "do not mutate picker input");
});

test("five-item cap respects retained selections, rejects overflow, and allows more after removal", () => {
  const files = [file("four.png", "image/png"), file("five.png", "image/png"), file("six.png", "image/png")];
  const result = media.selectPostMedia(files, 3);
  assert.deepEqual(result.accepted, files.slice(0, 2));
  assert.match(result.errors[0], /six.png.*up to 5.*Remove an item/);
  assert.equal(media.selectPostMedia([files[2]], 4).accepted.length, 1);
});

test("real byte limits accept boundaries and reject oversized images/videos with actionable errors", () => {
  const mib = 1024 * 1024;
  assert.equal(media.selectPostMedia([file("photo.png", "image/png", 20 * mib), file("clip.mov", "video/quicktime", 500 * mib)], 0).accepted.length, 2);
  const result = media.selectPostMedia([
    file("photo.png", "image/png", 20 * mib + 1),
    file("clip.mov", "video/quicktime", 500 * mib + 1),
    file("empty.jpg", "image/jpeg", 0),
    file("anim.gif", "image/gif"),
    file("safe.png", "image/png"),
  ], 0);
  assert.deepEqual(result.accepted.map((f: File) => f.name), ["safe.png"]);
  assert.match(result.errors[0], /photo.png.*20 MB.*Resize/);
  assert.match(result.errors[1], /clip.mov.*500 MB.*Trim/);
  assert.match(result.errors[2], /empty.jpg.*empty.*original file/);
  assert.match(result.errors[3], /anim.gif.*JPG, PNG or HEIC.*MP4 or MOV/);
});

test("valid videos the browser can't decode stay shareable; known errors and bad images stay fatal", () => {
  assert.equal(media.previewFailureOutcome(file("hevc.mov", "video/quicktime")), "unsupported-preview");
  assert.equal(media.previewFailureOutcome(file("clip.MOV", "")), "unsupported-preview");
  assert.equal(media.previewFailureOutcome(file("clip.mp4", "video/mp4")), "unsupported-preview");
  assert.equal(media.previewFailureOutcome(file("long.mp4", "video/mp4"), media.videoDurationError("long.mp4", 601)), "broken");
  assert.equal(media.previewFailureOutcome(file("bad.jpg", "image/jpeg")), "broken");
  assert.equal(media.previewFailureOutcome(file("bad.heic", "image/heic")), "broken");
  assert.equal(media.VIDEO_PREVIEW_UNSUPPORTED_COPY, "This browser can’t preview this video. We’ll prepare it when you share.");
  assert.equal(media.videoDurationError("x.mp4", Number.NaN), null, "unreadable duration defers to server validation");
});

test("profile visibility reads the backend publicProfile.enabled field", () => {
  assert.equal(media.profileIsPublic({ publicProfile: { enabled: true } }), true);
  assert.equal(media.profileIsPublic({ publicProfile: { enabled: false }, publicProfileSettings: { enabled: true } }), false);
  assert.equal(media.profileIsPublic({ publicProfileSettings: { enabled: true } }), true);
  assert.equal(media.profileIsPublic(null), false);
});
