// Firebase Storage REST API helper
// Uploads files using the caller's Firebase ID token — no Admin SDK required.
// The bucket name is read from FIREBASE_STORAGE_BUCKET (set as a Replit secret).

const STORAGE_API = "https://firebasestorage.googleapis.com/v0/b";

export function getBucket(): string {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error(
      "FIREBASE_STORAGE_BUCKET is not configured. " +
      "Add it as a secret in the Replit environment (e.g. my-project.appspot.com).",
    );
  }
  return bucket;
}

/**
 * Called during server startup to surface a missing bucket configuration
 * early rather than on the first upload request.
 */
export function assertStorageBucketConfigured(): void {
  getBucket(); // throws if not set
}

/**
 * Upload a file Buffer to Firebase Storage and return the public download URL.
 *
 * @param filePath  Storage object path, e.g. "updates/orgId/timestamp/photo.jpg"
 * @param buffer    File data as a Buffer
 * @param mimeType  MIME type e.g. "image/jpeg"
 * @param idToken   Firebase ID token of the authenticated user
 */
export async function uploadToStorage(
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  idToken: string,
): Promise<string> {
  const bucket = getBucket();
  const encodedPath = encodeURIComponent(filePath);

  const uploadUrl =
    `${STORAGE_API}/${encodeURIComponent(bucket)}/o` +
    `?uploadType=media&name=${encodedPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "Authorization": `Bearer ${idToken}`,
    },
    body: buffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Firebase Storage upload failed (HTTP ${response.status}): ${text.slice(0, 300)}`,
    );
  }

  const result = await response.json() as { name: string; downloadTokens?: string };

  if (!result.name) {
    throw new Error("Firebase Storage upload returned no object name");
  }

  const token = result.downloadTokens ?? "";
  const encodedName = encodeURIComponent(result.name);
  const downloadUrl =
    `${STORAGE_API}/${encodeURIComponent(bucket)}/o/${encodedName}?alt=media&token=${token}`;

  return downloadUrl;
}

/**
 * Build the storage path for an update media file.
 * Pattern: updates/{orgId}/{timestamp}/{filename}
 * The sanitised filename preserves the original extension so the download URL
 * can be inspected for video vs image by extension (.mp4, .mov, .webm, etc.).
 */
export function updateMediaPath(orgId: string, filename: string): string {
  const timestamp = Date.now();
  // Keep alphanumerics, dots, underscores and hyphens; replace everything else
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `updates/${orgId}/${timestamp}/${safe}`;
}
