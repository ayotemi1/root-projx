import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "../lib/auth.js";
import { uploadToStorage, updateMediaPath } from "../lib/firebase-storage.js";

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

/**
 * Wrap multer inside the async route handler so errors are caught by the
 * route's try/catch rather than falling through to Express's default error
 * handler (which would send an HTML 500 with no useful message to the client).
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

    // Parse the multipart body inside the handler so errors are catchable
    await runMulter(req, res);

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const orgId = req.user!.userId;
    // The Bearer token is the caller's Firebase ID token — used to authenticate
    // the upload with Firebase Storage REST API
    const idToken = req.headers.authorization!.slice(7);

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const storagePath = updateMediaPath(orgId, file.originalname);
        const url = await uploadToStorage(
          storagePath,
          file.buffer,
          file.mimetype,
          idToken,
        );
        return { url, name: file.originalname, type: file.mimetype, size: file.size };
      }),
    );

    const urls = uploadResults.map((r) => r.url);
    req.log.info({ orgId, count: urls.length }, "Media uploaded to Firebase Storage");

    res.json({ urls, files: uploadResults });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    req.log.error({ err }, "POST /uploads/media error");

    // Multer validation errors are client mistakes (4xx), not server faults
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

export default router;
