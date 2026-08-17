import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../lib/auth.js";
import { adminUploadFile } from "../lib/firebase-admin.js";
import { updateMediaPath, orgProfilePath } from "../lib/firebase-storage.js";

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
// Query params:
//   ?type=logo    — org profile logo  (stable path, overwrites previous)
//   ?type=cover   — org cover photo   (stable path, overwrites previous)
//   ?type=media   — feed update media (timestamped, default)
//
// Accepts: multipart/form-data with up to 5 files under the "files" field
// Returns: { urls: string[], files: Array<{ url, name, type, size }> }
//
// Uses Firebase Admin SDK — bypasses Storage security rules so uploads work
// regardless of whether storage.rules have been deployed to Firebase Console.
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
        let storagePath: string;
        if (uploadType === "logo") {
          storagePath = orgProfilePath(orgId, "logo");
        } else if (uploadType === "cover") {
          storagePath = orgProfilePath(orgId, "cover");
        } else {
          storagePath = updateMediaPath(orgId, file.originalname);
        }

        const url = await adminUploadFile(storagePath, file.buffer, file.mimetype);
        return { url, name: file.originalname, type: file.mimetype, size: file.size };
      }),
    );

    const urls = uploadResults.map((r) => r.url);
    req.log.info({ orgId, uploadType, count: urls.length }, "Media uploaded via Admin SDK");

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
