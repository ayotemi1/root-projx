// Firebase Storage REST API helper
// Uploads files using the caller's Firebase ID token — no Admin SDK required

const STORAGE_API = "https://firebasestorage.googleapis.com/v0/b";

function getBucket(): string {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) throw new Error("FIREBASE_STORAGE_BUCKET is not configured");
  return bucket;
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
    throw new Error(`Firebase Storage upload failed (${response.status}): ${text}`);
  }

  const result = await response.json() as { name: string; downloadTokens?: string };

  const token = result.downloadTokens ?? "";
  const encodedName = encodeURIComponent(result.name);
  const downloadUrl =
    `${STORAGE_API}/${encodeURIComponent(bucket)}/o/${encodedName}?alt=media&token=${token}`;

  return downloadUrl;
}

/**
 * Build the storage path for an update media file.
 * Pattern: updates/{orgId}/{timestamp}/{filename}
 */
export function updateMediaPath(orgId: string, filename: string): string {
  const timestamp = Date.now();
  // Sanitise filename — keep extension, strip unsafe characters
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `updates/${orgId}/${timestamp}/${safe}`;
}
