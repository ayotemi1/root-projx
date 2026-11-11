export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const VIDEO_SIZE_LIMIT = "500 MB";
export type UploadFeedback = { message: string; retryable: boolean };

export function formatUploadSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  // Round upwards so a file just over the limit doesn't appear to be within it.
  return `${Math.ceil(bytes / (1024 * 1024) * 10) / 10} MB`;
}

export function videoFileProblem(file: { size: number; type: string }): UploadFeedback | null {
  if (file.size > MAX_VIDEO_BYTES) return {
    message: `Your video is ${formatUploadSize(file.size)}. The maximum is ${VIDEO_SIZE_LIMIT} per video. Export a smaller version (for example, 720p), trim it, or add a YouTube/Vimeo link instead.`,
    retryable: false,
  };
  if (!file.size) return { message: "This video file is empty. Choose a different file.", retryable: false };
  if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) return {
    message: "This video format isn't supported. Choose an MP4, MOV or WebM file, up to 500 MB.",
    retryable: false,
  };
  return null;
}

export function uploadFeedback(error: unknown, kind: string, size?: number): UploadFeedback {
  const raw = error instanceof Error ? error.message : "";
  const explicitStatus = (error as { status?: number } | null)?.status;
  const status = explicitStatus || Number(raw.match(/\b(400|401|403|408|413|415|429|5\d\d)\b/)?.[1]);
  if (status === 413 || /too large|file too large|LIMIT_FILE_SIZE/i.test(raw)) {
    if (kind === "video") return {
      message: size != null && size > MAX_VIDEO_BYTES
        ? videoFileProblem({ size, type: "video/mp4" })!.message
        : `The server rejected this video because the upload was too large${size != null ? ` (${formatUploadSize(size)})` : ""}. Videos can be up to 500 MB. If yours is within that limit, the website may still be using the older uploader. You can also export a smaller version or use a YouTube/Vimeo link.`,
      retryable: false,
    };
    return { message: "This file is too large. Images and subtitle files must be no larger than 20 MB. Choose a smaller file.", retryable: false };
  }
  if (status === 401) return { message: "Your sign-in session has expired. Sign in again, then retry the upload.", retryable: false };
  if (status === 403) return {
    message: (error as { stage?: string })?.stage === "storage"
      ? "The upload permission expired or was rejected by storage. Try again to request a fresh upload link."
      : "You don't have permission to upload to this organisation. Check that you're signed into the right account.",
    retryable: (error as { stage?: string })?.stage === "storage",
  };
  if (status === 415 || /file type|format|not a supported video/i.test(raw))
    return { message: "This file format isn't supported. For videos, choose MP4, MOV or WebM, up to 500 MB.", retryable: false };
  if (status === 429) return { message: "Too many uploads were attempted. Please wait before trying again.", retryable: false };
  if (status === 408 || /timed? out|timeout/i.test(raw))
    return { message: "The upload took too long. Try again on a stronger connection, or export a smaller video.", retryable: true };
  if (status >= 500)
    return { message: "The upload service is temporarily unavailable. Your saved campaign hasn't been changed. Please try again shortly.", retryable: true };
  if (/network|fetch|connection|interrupted/i.test(raw))
    return { message: "The connection was interrupted before the upload could be confirmed. Check your internet connection and try again.", retryable: true };
  return {
    message: raw && !/^Upload failed\.?(?: \(\d+\))?$/i.test(raw)
      ? raw : "The file couldn't be uploaded. Please try again, or choose another file.",
    retryable: true,
  };
}
