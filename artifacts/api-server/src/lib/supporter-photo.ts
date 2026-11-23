import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { objectStorageClient } from "./objectStorage.js";
import { AccountError } from "./supporter-account.js";

const exec = promisify(execFile);
export const PHOTO_LIMIT = 20 * 1024 * 1024;
export const PHOTO_ID = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export function photoObject(photoId: string) {
  if (!PHOTO_ID.test(photoId)) throw new AccountError(400);
  const parts = (process.env.PRIVATE_OBJECT_DIR || "").replace(/^\/+/, "").split("/");
  const bucket = parts.shift();
  if (!bucket) throw new Error("Photo storage unavailable");
  const prefix = parts.filter(Boolean).join("/");
  return objectStorageClient.bucket(bucket).file(`${prefix ? `${prefix}/` : ""}supporter-avatars/${photoId}.jpg`);
}
export async function stagePhoto(uid: string, bytes: Buffer, mime: string) {
  if (!["image/jpeg", "image/png"].includes(mime)) throw new AccountError(400, "Choose a square JPG or PNG photo");
  if (bytes.length > PHOTO_LIMIT) throw new AccountError(400, "Use a photo smaller than 20 MB");
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/png" ? !png : !jpeg) throw new AccountError(400, "Choose a square JPG or PNG photo");
  const dir = await mkdtemp(join(tmpdir(), "rp-avatar-"));
  try {
    const input = join(dir, png ? "source.png" : "source.jpg"), output = join(dir, "avatar.jpg");
    await writeFile(input, bytes);
    let probe: { streams?: Array<{ codec_name: string; width: number; height: number }> };
    try {
      const result = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "json", input],
        { timeout: 10_000, maxBuffer: 100_000 });
      probe = JSON.parse(result.stdout);
    } catch { throw new AccountError(400, "Choose a square JPG or PNG photo"); }
    const image = probe.streams?.[0];
    if (!image || !["png", "mjpeg"].includes(image.codec_name)) throw new AccountError(400, "Choose a square JPG or PNG photo");
    if (image.width < 400 || image.height < 400) throw new AccountError(400, "That photo is too small");
    if (image.width !== image.height) throw new AccountError(400, "Choose a square JPG or PNG photo");
    if (image.width * image.height > 40_000_000) throw new AccountError(400, "Try a smaller JPG or PNG photo");
    const size = Math.min(800, image.width);
    // Re-encode, stripping EXIF/GPS, animation and arbitrary embedded metadata.
    await exec("ffmpeg", ["-v", "error", "-i", input, "-vf", `scale=${size}:${size}`, "-frames:v", "1", "-map_metadata", "-1", "-threads", "1", "-q:v", "3", output],
      { timeout: 15_000, maxBuffer: 100_000 });
    const photoId = randomUUID();
    await photoObject(photoId).save(await readFile(output), {
      resumable: false, contentType: "image/jpeg", metadata: { cacheControl: "private, no-store", metadata: { ownerUid: uid } },
    });
    return { photoId, previewUrl: `/api/supporter-posts/media/avatars/${photoId}` };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
export async function validateOwnedPhoto(uid: string, photoId: string) {
  const file = photoObject(photoId);
  const [exists] = await file.exists();
  if (!exists) throw new AccountError(400, "Upload your photo again");
  const [metadata] = await file.getMetadata();
  if (metadata.metadata?.ownerUid !== uid) throw new AccountError(404);
  return file;
}
