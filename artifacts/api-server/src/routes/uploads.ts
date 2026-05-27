import { Router, type Request, type Response } from "express";
import multer from "multer";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth.js";

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

// Multer instance — memory storage, hard limits, strict MIME allowlist
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per file
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

// Replit sidecar-authenticated GCS client
const gcsClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: "http://127.0.0.1:1106/token",
    type: "external_account",
    credential_source: {
      url: "http://127.0.0.1:1106/credential",
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  projectId: "",
});

async function uploadBufferToGCS(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not configured");

  // Sanitise filename: keep alphanumerics, dots, underscores, hyphens
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectName = `uploads/${randomUUID()}/${safe}`;

  const bucket = gcsClient.bucket(bucketId);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    metadata: { contentType: mimeType },
    public: true,
  });

  return `https://storage.googleapis.com/${bucketId}/${objectName}`;
}

/**
 * Wrap multer inside the async route handler so errors are caught by the
 * route's try/catch rather than falling through to Express's default error
 * handler.
 */
function runMulter(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.array("files", 5)(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// POST /uploads/media
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

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const url = await uploadBufferToGCS(file.buffer, file.mimetype, file.originalname);
        return { url, name: file.originalname, type: file.mimetype, size: file.size };
      }),
    );

    const urls = uploadResults.map((r) => r.url);
    req.log.info({ orgId, count: urls.length }, "Media uploaded to Replit Object Storage");

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
