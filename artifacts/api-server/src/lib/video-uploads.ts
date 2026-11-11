import { randomUUID } from "node:crypto";
import { objectStorageClient, signObjectURL } from "./objectStorage.js";

export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export class VideoUploadError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function bucketName() {
  const name = (process.env.PRIVATE_OBJECT_DIR || "").replace(/^\//, "").split("/")[0];
  if (!name) throw new Error("Storage is not configured");
  return name;
}

export async function requestVideoUpload(orgId: string, input: Record<string, unknown>) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 255 ||
    typeof input.contentType !== "string" || !VIDEO_TYPES.has(input.contentType) ||
    !Number.isSafeInteger(input.size) || Number(input.size) <= 0) {
    throw new VideoUploadError(400, "Choose an MP4, MOV or WebM video file.");
  }
  if (Number(input.size) > MAX_VIDEO_BYTES) {
    throw new VideoUploadError(413, "Video is too large. Maximum video size is 500 MB.");
  }
  const name = input.name.split(/[/\\]/).pop()!.replace(/[^\w.-]/g, "_").slice(-100) || "video";
  const objectPath = `org-media-pending/${orgId}/${randomUUID()}/${name}`;
  const uploadUrl = await signObjectURL({
    bucketName: bucketName(), objectName: objectPath, method: "PUT", ttlSec: 3600,
  });
  return { uploadUrl, objectPath };
}

/** Pending uploads are never served by the public media proxy. Verify storage's
 * actual metadata, not the browser's declared size/type, before promoting them.
 */
export async function completeVideoUpload(orgId: string, path: unknown) {
  const prefix = `org-media-pending/${orgId}/`;
  if (typeof path !== "string" || !path.startsWith(prefix) ||
    !/^[0-9a-f-]{36}\/[\w.-]{1,100}$/.test(path.slice(prefix.length))) {
    throw new VideoUploadError(403, "This upload does not belong to your organisation.");
  }
  const finalPath = `org-media/${orgId}/videos/${path.slice(prefix.length)}`;
  const bucket = objectStorageClient.bucket(bucketName());
  const pending = bucket.file(path);
  const final = bucket.file(finalPath);
  let source = pending;
  let metadata;
  try {
    [metadata] = await pending.getMetadata();
  } catch (err) {
    if ((err as { code?: number }).code !== 404) throw err;
    // Completing twice (e.g. a lost response) returns the same asset, not a new copy.
    source = final;
    try { [metadata] = await final.getMetadata(); }
    catch (error) {
      if ((error as { code?: number }).code === 404)
        throw new VideoUploadError(400, "The upload is not complete. Please try again.");
      throw error;
    }
  }
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size <= 0 || !VIDEO_TYPES.has(metadata.contentType || "")) {
    throw new VideoUploadError(400, "The uploaded file is not a supported video.");
  }
  if (size > MAX_VIDEO_BYTES) {
    throw new VideoUploadError(413, "Video is too large. Maximum video size is 500 MB.");
  }
  if (source === pending) {
    // A signed PUT remains valid until expiry. Copy the inspected generation,
    // not a replacement someone uploaded between validation and promotion.
    const verified = metadata.generation ? bucket.file(path, { generation: metadata.generation }) : pending;
    await verified.move(final);
  }
  return finalPath;
}
