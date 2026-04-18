import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../lib/auth.js";
import { uploadToStorage, updateMediaPath } from "../lib/firebase-storage.js";

const router = Router();

// ── Multer: memory storage (no disk writes) ────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per file
    files: 5,                   // max 5 files per request
  },
  fileFilter(_req, file, cb) {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

// POST /uploads/media — upload up to 5 images/videos for an update
// Returns { urls: string[] }
router.post(
  "/uploads/media",
  requireAuth,
  upload.array("files", 5),
  async (req, res) => {
    try {
      if (req.user!.accountType !== "organisation") {
        res.status(403).json({ error: "Only organisation accounts can upload media" });
        return;
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files provided" });
        return;
      }

      const orgId = req.user!.userId;
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
      res.status(500).json({ error: message });
    }
  },
);

export default router;
