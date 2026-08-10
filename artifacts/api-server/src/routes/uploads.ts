import { Router } from "express";
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
    // Extract the Firebase ID token — already validated by requireAuth
    const idToken = req.headers.authorization!.slice(7);

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const storagePath = updateMediaPath(orgId, file.originalname);
        const url = await uploadToStorage(storagePath, file.buffer, file.mimetype, idToken);
        return { url, name: file.originalname, type: file.mimetype, size: file.size };
      }),
    );

    const urls = uploadResults.map((r) => r.url);
    req.log.info({ orgId, count: urls.length }, "Media uploaded to Firebase Storage");

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
