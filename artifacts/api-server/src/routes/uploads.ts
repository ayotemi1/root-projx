import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../lib/auth.js";
import { objectStorageClient } from "../lib/objectStorage.js";

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

// Multer — memory storage, 20 MB per file, up to 5 files, strict MIME allowlist
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 5,
  },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(
          new multer.MulterError("LIMIT_UNEXPECTED_FILE"),
          { message: `File type "${file.mimetype}" is not allowed` },
        ),
      );
    }
  },
});

function runMulter(req: import("express").Request, res: import("express").Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.array("files", 5)(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Extract the bucket name from PRIVATE_OBJECT_DIR which has the format:
 *   /bucketname/some/prefix
 */
function getObjectStorageBucketName(): string {
  const dir = (process.env.PRIVATE_OBJECT_DIR ?? "").replace(/^\//, "");
  const bucketName = dir.split("/")[0] ?? "";
  if (!bucketName) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return bucketName;
}

/**
 * Upload a feed update media file (photo/video) to Replit Object Storage.
 * Uses a timestamped path so multiple uploads don't overwrite each other.
 * The file is made publicly readable so it can be served directly in the feed.
 */
async function uploadFeedMedia(
  orgId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const bucketName = getObjectStorageBucketName();
  // Sanitise filename: strip path components, replace spaces
  const safeName = filename.replace(/.*[/\\]/, "").replace(/\s+/g, "_") || "upload";
  const objectPath = `org-media/${orgId}/${Date.now()}/${safeName}`;
  const file = objectStorageClient.bucket(bucketName).file(objectPath);

  await file.save(buffer, {
    contentType: mimeType,
    public: true,
    resumable: false,
  });

  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}

/**
 * Upload an org profile image (logo or cover) to Replit Object Storage.
 * Uses stable, overwriteable paths so re-uploading replaces the previous image.
 * The file is made publicly readable so the URL works without authentication.
 *
 * Uses Replit Object Storage (not Firebase Storage) to avoid Firebase IAM
 * permission issues with the Replit sidecar service account.
 */
async function uploadOrgProfileImage(
  orgId: string,
  type: "logo" | "cover",
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const bucketName = getObjectStorageBucketName();
  const objectPath = `org-profiles/${orgId}/${type}`;
  const file = objectStorageClient.bucket(bucketName).file(objectPath);

  await file.save(buffer, {
    contentType: mimeType,
    // Make publicly readable so the URL can be used directly in <img> tags
    public: true,
    // Overwrite in place — no versioning needed for profile images
    resumable: false,
  });

  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}

// POST /uploads/media
// Query params:
//   ?type=logo    — org profile logo  (Replit Object Storage, stable path)
//   ?type=cover   — org cover photo   (Replit Object Storage, stable path)
//   ?type=media   — feed update media (Firebase Storage, timestamped)
//
// Accepts: multipart/form-data with up to 5 files under the "files" field
// Returns: { urls: string[], files: Array<{ url, name, type, size }> }
router.post("/uploads/media", requireAuth, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can upload media" });
      return;
    }

    await runMulter(req, res);

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const orgId = req.user!.userId;
    const uploadType = (req.query.type as string | undefined) ?? "media";

    if (!["logo", "cover", "media"].includes(uploadType)) {
      res.status(400).json({ error: "type must be logo, cover, or media" });
      return;
    }

    // Profile image uploads are single-file only
    if ((uploadType === "logo" || uploadType === "cover") && files.length > 1) {
      res.status(400).json({ error: "Profile image uploads must be a single file" });
      return;
    }

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        let url: string;

        if (uploadType === "logo" || uploadType === "cover") {
          // Use Replit Object Storage — the sidecar service account has full
          // access to this bucket without any Firebase IAM configuration.
          url = await uploadOrgProfileImage(orgId, uploadType, file.buffer, file.mimetype);
          req.log.info({ orgId, uploadType }, "Profile image uploaded to Replit Object Storage");
        } else {
          // Feed update media goes to Replit Object Storage — same bucket,
          // timestamped path so multiple uploads don't collide.
          url = await uploadFeedMedia(orgId, file.originalname, file.buffer, file.mimetype);
          req.log.info({ orgId, uploadType }, "Feed media uploaded to Replit Object Storage");
        }

        return { url, name: file.originalname, type: file.mimetype, size: file.size };
      }),
    );

    const urls = uploadResults.map((r) => r.url);
    res.json({ urls, files: uploadResults });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    req.log.error({ err }, "POST /uploads/media error");

    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

export default router;
