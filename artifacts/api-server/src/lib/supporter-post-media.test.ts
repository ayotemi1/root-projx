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

test("supporter media picker matches real image and video formats, not the mockup's HEIC claim", () => {
  for (const type of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
    assert.equal(media.postMediaKind(file("photo", type)), "image");
    assert.ok(media.POST_MEDIA_ACCEPT.includes(type));
  }
  for (const type of ["video/mp4", "video/quicktime", "video/webm"]) {
    assert.equal(media.postMediaKind(file("video", type)), "video");
    assert.ok(media.POST_MEDIA_ACCEPT.includes(type));
  }
  assert.equal(media.postMediaKind(file("photo.heic", "image/heic")), null);
  assert.equal(media.postMediaKind(file("unknown.jpg", "")), null);
  assert.doesNotMatch(media.POST_MEDIA_ACCEPT, /heic/);
  assert.match(media.POST_MEDIA_LIMITS_COPY, /no fixed video-duration limit/);
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
    file("phone.heic", "image/heic"),
    file("safe.png", "image/png"),
  ], 0);
  assert.deepEqual(result.accepted.map((f: File) => f.name), ["safe.png"]);
  assert.match(result.errors[0], /photo.png.*20 MB.*Resize/);
  assert.match(result.errors[1], /clip.mov.*500 MB.*Trim/);
  assert.match(result.errors[2], /empty.jpg.*empty.*original file/);
  assert.match(result.errors[3], /phone.heic.*Export HEIC photos as JPG or PNG/);
});
