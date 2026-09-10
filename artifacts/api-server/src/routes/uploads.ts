import { Router } from "express";
import multer from "multer";
import { requireApprovedOrganisation, requireAuth } from "../lib/auth.js";
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

/** Derive the request origin for building absolute URLs (feed media only). */
function getRequestOrigin(req: import("express").Request): string {
  const proto = (req.get("x-forwarded-proto") ?? req.protocol) || "https";
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

/**
 * Extract the bucket name from PRIVATE_OBJECT_DIR (format: /bucketname/some/prefix).
 */
function getObjectStorageBucketName(): string {
  const dir = (process.env.PRIVATE_OBJECT_DIR ?? "").replace(/^\//, "");
  const bucketName = dir.split("/")[0] ?? "";
  if (!bucketName) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return bucketName;
}

// Valid GCS object path prefixes that the legacy proxy is allowed to serve.
// Prevents the proxy being used to read arbitrary bucket objects.
const ALLOWED_PATH_PREFIXES = ["org-profiles/", "org-media/"];

// ---------------------------------------------------------------------------
// GET /uploads/object/* — proxy route
// Streams a Replit Object Storage file through the server.
// No auth required — org images are public-facing.
// ---------------------------------------------------------------------------
// Using router.use() instead of router.get() to avoid path-to-regexp v8
// named-wildcard requirement — req.path contains everything after the prefix.
router.use("/uploads/object", async (req, res) => {
  const objectPath = req.path.replace(/^\//, "");

  if (!objectPath || !ALLOWED_PATH_PREFIXES.some((p) => objectPath.startsWith(p))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const bucketName = getObjectStorageBucketName();
    const file = objectStorageClient.bucket(bucketName).file(objectPath);

    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    const [metadata] = await file.getMetadata();
    res.set("Content-Type", (metadata.contentType as string) || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
    if (metadata.size) res.set("Content-Length", String(metadata.size));

    file.createReadStream().pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Failed to serve file" });
  }
});

/**
 * Upload a feed update media file (photo/video) to Replit Object Storage.
 * Timestamped path — multiple uploads don't overwrite each other.
 * Returns the GCS object path (not a URL); the route handler builds the URL.
 */
async function uploadFeedMedia(
  orgId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const bucketName = getObjectStorageBucketName();
  const safeName = filename.replace(/.*[/\\]/, "").replace(/\s+/g, "_") || "upload";
  const objectPath = `org-media/${orgId}/${Date.now()}/${safeName}`;
  const file = objectStorageClient.bucket(bucketName).file(objectPath);

  await file.save(buffer, {
    contentType: mimeType,
    resumable: false,
  });

  return objectPath;
}

// ---------------------------------------------------------------------------
// POST /uploads/media?type=media — feed update media (photos / videos)
// Up to 5 files. Returns { urls, files } with proxy URLs via /uploads/object/*.
// Profile image uploads (logo/cover) are handled by POST /organisations/:id/images.
// ---------------------------------------------------------------------------
router.post("/uploads/media", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can upload media" });
      return;
    }

    const uploadType = (req.query.type as string | undefined) ?? "media";
    if (uploadType !== "media") {
      res.status(400).json({ error: "This endpoint only accepts type=media. Use POST /organisations/:id/images for profile images." });
      return;
    }

    await runMulter(req, res);

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const orgId = req.user!.userId;

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const objectPath = await uploadFeedMedia(orgId, file.originalname, file.buffer, file.mimetype);
        req.log.info({ orgId }, "Feed media uploaded to Replit Object Storage");
        // Absolute URL so mobile clients can load it without a base URL
        const url = `${getRequestOrigin(req)}/api/uploads/object/${objectPath}`;
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
