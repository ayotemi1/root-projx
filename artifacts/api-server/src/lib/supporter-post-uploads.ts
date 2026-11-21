import { randomUUID } from "node:crypto";
import { mkdtemp, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { objectStorageClient, signObjectURL } from "./objectStorage.js";
import { fsCompleteSupporterMedia, fsGet, fsPatch, getServerToken } from "./firebase-rest.js";
import { DEFAULT_ADJUSTMENTS, DEFAULT_CROP, MEDIA, mediaDto, PostError, UUID } from "./supporter-posts.js";

const exec = promisify(execFile);
export const IMAGE_LIMIT = 20 * 1024 * 1024;
export const VIDEO_LIMIT = 500 * 1024 * 1024;
export const VIDEO_SECONDS = 600;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
export function validateUpload(input: { name: string; size: number; contentType: string }) {
  const video = VIDEO_TYPES.has(input.contentType);
  if (!IMAGE_TYPES.has(input.contentType) && !video)
    throw new PostError(400, "Choose a JPG, PNG or HEIC photo, or an MP4 or MOV video.");
  if (!input.name || input.name.length > 255 || !Number.isSafeInteger(input.size) || input.size <= 0)
    throw new PostError(400, "This file is empty or invalid. Please choose the original file again.");
  if (input.size > (video ? VIDEO_LIMIT : IMAGE_LIMIT))
    throw new PostError(413, video ? "Videos can be up to 500 MB and 10 minutes. Trim or export a smaller video." :
      "Photos can be up to 20 MB. Resize the photo or export a smaller copy.");
  return video;
}
function bucket() {
  const name = (process.env.PRIVATE_OBJECT_DIR ?? "").replace(/^\//, "").split("/")[0];
  if (!name) throw new PostError(503);
  return objectStorageClient.bucket(name);
}
export async function requestPostUpload(author: string, input: { name: string; size: number; contentType: string }) {
  validateUpload(input);
  const id = randomUUID();
  const objectPath = `supporter-pending/${author}/${id}/input`;
  // A pending object is not published or served. The signed URL can write ONLY
  // this random key; completion copies a fixed generation before inspection.
  const uploadUrl = await signObjectURL({ bucketName: bucket().name, objectName: objectPath, method: "PUT", ttlSec: 3600 });
  await fsPatch(MEDIA, id, {
    id, author_id: author, state: "pending", post_id: null, objectPath,
    declared_size: input.size, content_type: input.contentType, created_at: new Date().toISOString(),
  }, await getServerToken());
  return { uploadUrl, objectPath };
}

const inFlight = new Map<string, Promise<ReturnType<typeof mediaDto>>>();
const failed = new Map<string, { error: unknown; at: number }>();
let activeWorkers = 0;
const waitingWorkers: Array<() => void> = [];
async function withMediaWorker<T>(work: () => Promise<T>): Promise<T> {
  if (activeWorkers < 2) activeWorkers++;
  else {
    if (waitingWorkers.length >= 25) throw new PostError(429);
    await new Promise<void>(resolve => waitingWorkers.push(resolve));
  }
  try { return await work(); }
  finally {
    const next = waitingWorkers.shift();
    if (next) next(); // transfer this slot rather than exposing a racing vacancy
    else activeWorkers--;
  }
}
export async function completePostUpload(author: string, path: string) {
  const prefix = `supporter-pending/${author}/`;
  const suffix = path.startsWith(prefix) ? path.slice(prefix.length).split("/") : [];
  if (suffix.length !== 2 || !UUID.test(suffix[0]!) || suffix[1] !== "input") throw new PostError(403);
  const id = suffix[0]!;
  const key = `${author}:${id}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const failure = failed.get(key);
  if (failure) {
    failed.delete(key);
    if (Date.now() - failure.at < 20 * 60_000) return Promise.reject(failure.error);
  }
  const promise = withMediaWorker(() => inspectAndComplete(author, id, path))
    .catch(error => {
      for (const [k, v] of failed) if (Date.now() - v.at > 20 * 60_000) failed.delete(k);
      if (failed.size >= 500) {
        const oldest = failed.keys().next().value;
        if (oldest) failed.delete(oldest);
      }
      failed.set(key, { error, at: Date.now() }); throw error;
    }).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function inspectAndComplete(author: string, id: string, path: string) {
  const token = await getServerToken();
  const record = await fsGet(MEDIA, id, token);
  if (!record || record.author_id !== author || record.objectPath !== path) throw new PostError(404);
  if (record.state === "ready") return mediaDto(record);
  const b = bucket();
  const pending = b.file(path);
  const [metadata] = await pending.getMetadata();
  const input = { name: "media", size: Number(metadata.size), contentType: String(record.content_type) };
  const video = validateUpload(input);
  if (Number(record.declared_size) !== input.size) throw new PostError(400, "The upload is incomplete. Please select the original file and retry.");
  const dir = await mkdtemp(join(tmpdir(), "rpx-supporter-"));
  const local = join(dir, "input");
  // Generation-qualified reads prevent overwriting a pending URL while it is
  // being checked from substituting a different file into a published post.
  const verified = b.file(path, { generation: metadata.generation });
  try {
    await pipeline(verified.createReadStream(), createWriteStream(local));
    const handle = await open(local, "r");
    const bytes = Buffer.alloc(32);
    try { await handle.read(bytes, 0, 32, 0); } finally { await handle.close(); }
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const heic = bytes.toString("ascii", 4, 8) === "ftyp" && /hei[cfx]|mif1|msf1/.test(bytes.toString("ascii", 8, 32));
    if (!video && !jpeg && !png && !heic) throw new PostError(400, "This is not a readable JPG, PNG or HEIC photo. Export it again and retry.");
    let mediaFile = local;
    let contentType = jpeg ? "image/jpeg" : "image/png";
    if (!video) {
      // Normalise phone orientation and remove EXIF/GPS before making a photo
      // viewable. PNG transparency remains intact; HEIC becomes browser-safe JPEG.
      mediaFile = join(dir, jpeg || heic ? "converted.jpg" : "converted.png");
      await exec("magick", ["-limit", "memory", "128MiB", "-limit", "map", "256MiB",
        "-limit", "disk", "512MiB", local, "-auto-orient", "-colorspace", "sRGB", "-strip", "-quality", "92", mediaFile],
      { timeout: 60_000, maxBuffer: 1024 * 1024 });
      contentType = jpeg || heic ? "image/jpeg" : "image/png";
    }
    const { stdout } = await exec("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", mediaFile],
      { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    const probe = JSON.parse(stdout);
    let stream = probe.streams?.find((s: any) => s.codec_type === "video");
    if (!stream?.width || !stream.height || stream.width * stream.height > 100_000_000)
      throw new PostError(400, "This file cannot be read safely. Please export a smaller JPG, PNG or MP4 copy.");
    const duration = video ? Number(probe.format?.duration ?? stream.duration) : null;
    if (video && (!Number.isFinite(duration) || Number(duration) <= 0 || Number(duration) > VIDEO_SECONDS))
      throw new PostError(400, "Videos can be up to 10 minutes. Trim this video and try again.");
    if (video && (!String(probe.format?.format_name).includes("mov") || ["mjpeg", "png"].includes(stream.codec_name)))
      throw new PostError(400, "Choose an MP4 or MOV video with a readable video track.");
    const base = `supporter-private/${author}/${id}/${randomUUID()}`;
    const storagePath = `${base}/media`;
    if (video) {
      // Normalise MOV/HEVC and other phone codecs to an interoperable MP4.
      mediaFile = join(dir, "video.mp4");
      const copyVideo = stream.codec_name === "h264" && stream.pix_fmt === "yuv420p" && stream.width <= 1920 &&
        !stream.side_data_list?.some((s: any) => s.rotation);
      const codec = copyVideo ? ["-c:v", "copy"] : [
        "-vf", "scale='min(1920,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      ];
      await exec("ffmpeg", ["-v", "error", "-y", "-i", local, "-map", "0:v:0", "-map", "0:a?",
        ...codec, "-c:a", "aac", "-map_metadata", "-1", "-movflags", "+faststart", mediaFile],
      { timeout: 15 * 60_000, maxBuffer: 1024 * 1024 });
      contentType = "video/mp4";
      const output = await exec("ffprobe", ["-v", "error", "-show_streams", "-of", "json", mediaFile],
        { timeout: 30_000, maxBuffer: 1024 * 1024 });
      stream = JSON.parse(output.stdout).streams.find((s: any) => s.codec_type === "video");
    }
    await b.upload(mediaFile, {
      destination: storagePath, resumable: video,
      metadata: { contentType, cacheControl: "private, no-store" },
    });
    let thumbnail: string | null = null;
    if (video) {
      thumbnail = `${base}/thumbnail.jpg`;
      const thumb = join(dir, "thumbnail.jpg");
      await exec("ffmpeg", ["-v", "error", "-y", "-i", mediaFile, "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", thumb],
        { timeout: 30_000, maxBuffer: 1024 * 1024 });
      await b.upload(thumb, { destination: thumbnail, metadata: { contentType: "image/jpeg", cacheControl: "private, no-store" } });
    }
    const ready = {
      ...record, state: "ready", storage_path: storagePath, thumbnail_path: thumbnail,
      type: video ? "video" : "photo", url: `/api/supporter-posts/media/${id}`,
      video_thumbnail_url: video ? `/api/supporter-posts/media/${id}/thumbnail` : null,
      width: stream.width, height: stream.height, duration, content_type: contentType,
      order: 0, crop: DEFAULT_CROP, filter: "original", adjustments: DEFAULT_ADJUSTMENTS,
    };
    const committed = await fsCompleteSupporterMedia(id, ready, token);
    // Best-effort hygiene, never the source of truth for publication.
    await verified.delete().catch(() => {});
    return mediaDto(committed);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function mediaObject(storagePath: string) {
  if (!storagePath.startsWith("supporter-private/")) throw new PostError(404);
  return bucket().file(storagePath);
}
