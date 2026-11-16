import { videoFileProblem } from "./upload-feedback";
import { appFetch, responseError } from "./error-feedback";
export { MAX_VIDEO_BYTES } from "./upload-feedback";

/** Only small JSON requests pass through the application. Video bytes go
 * directly to storage, avoiding the multipart/proxy request-size limits.
 */
export async function uploadVideo(file: File | Blob, token: string, apiBase: string,
  onProgress?: (fraction: number) => void): Promise<string> {
  const problem = videoFileProblem(file);
  if (problem) throw Object.assign(new Error(problem.message), { retryable: false });
  const json = async (path: string, body: object) => {
    const response = await appFetch(`${apiBase}${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw Object.assign(await responseError(response, path.endsWith("/complete") ? "confirm the uploaded video" : "prepare the video upload"), { stage: "api" });
    const data = await response.json().catch(() => ({}));
    return data;
  };
  const target = await json("/uploads/video/request", {
    name: file instanceof File ? file.name : "video.mp4", contentType: file.type, size: file.size,
  });
  if (typeof target.uploadUrl !== "string" || typeof target.objectPath !== "string")
    throw new Error("The upload service didn’t provide a valid upload link. No video was uploaded. Try again shortly, or contact Root ProjX if it continues.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.uploadUrl);
    // Do not send the app's authentication token to storage.
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = 60 * 60_000;
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(0.95 * e.loaded / e.total);
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve()
      : reject(Object.assign(new Error(`Upload failed (${xhr.status})`), { status: xhr.status, stage: "storage" }));
    xhr.onerror = () => reject(new Error("Video upload interrupted. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("Video upload timed out. Try again on a stronger connection."));
    xhr.send(file);
  });
  const complete = await json("/uploads/video/complete", { objectPath: target.objectPath });
  if (typeof complete.url !== "string" || !complete.url)
    throw new Error("The video transfer finished, but the service didn’t confirm a saved video. Keep this page open and contact Root ProjX before uploading it again.");
  onProgress?.(1);
  return complete.url;
}
