import { completeUpload, putToSignedUrl, requestUpload, type SupporterPostMedia } from "./supporter-publishing";

/** Reuse inspected, private App Storage uploads, including EXIF stripping.
 * Attaching this media to an authorised post is a separate confirmed write. */
export async function uploadPostCover(file: File, token: string): Promise<SupporterPostMedia> {
  if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error("Choose a JPG or PNG cover.");
  const contentType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const target = await requestUpload(file, contentType, token);
  await putToSignedUrl(target.uploadUrl, file, file.type, () => {});
  return completeUpload(target.objectPath, token, () => {});
}
