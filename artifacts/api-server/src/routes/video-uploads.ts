import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireApprovedOrganisation, requireAuth } from "../lib/auth.js";
import { completeVideoUpload, requestVideoUpload, VideoUploadError } from "../lib/video-uploads.js";

const router = Router();
router.post("/uploads/video/request", requireAuth, requireApprovedOrganisation,
  rateLimit({ windowMs: 60 * 60_000, limit: 20, keyGenerator: req => req.user!.userId,
    standardHeaders: "draft-7", legacyHeaders: false,
    message: { error: "Too many video uploads. Please try again later." } }),
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { res.json(await requestVideoUpload(req.user!.userId, req.body || {})); }
    catch (err) {
      req.log.error({ orgId: req.user!.userId }, "Video upload request failed");
      res.status(err instanceof VideoUploadError ? err.status : 503).json({
        error: err instanceof VideoUploadError ? err.message : "Video storage is unavailable. Please try again.",
      });
    }
  });
router.post("/uploads/video/complete", requireAuth, requireApprovedOrganisation, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const path = await completeVideoUpload(req.user!.userId, req.body?.objectPath);
    // Match existing media responses: absolute URLs also work on mobile.
    const proto = req.get("x-forwarded-proto") || req.protocol;
    const host = req.get("x-forwarded-host") || req.get("host");
    res.json({ url: `${proto}://${host}/api/uploads/object/${path}` });
  } catch (err) {
    req.log.error({ orgId: req.user!.userId }, "Video upload completion failed");
    res.status(err instanceof VideoUploadError ? err.status : 503).json({
      error: err instanceof VideoUploadError ? err.message : "Could not finish saving the video. Please try again.",
    });
  }
});
export default router;
