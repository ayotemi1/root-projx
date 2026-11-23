import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import {
  GetSupporterAccountResponse, SaveSupporterAccountProfileBody, SaveSupporterAccountSettingsBody,
  SaveSupporterAccountProfileResponse, SaveSupporterAccountSettingsResponse, UploadSupporterAccountPhotoResponse,
  DiscardSupporterAccountPhotoParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth.js";
import { fsGet, getServerToken } from "../lib/firebase-rest.js";
import { accountUser, accountView, saveAccountProfile, saveAccountSetting, rememberNotificationEmail, AccountError, ACCOUNT_ERROR } from "../lib/supporter-account.js";
import { PHOTO_ID, PHOTO_LIMIT, stagePhoto, validateOwnedPhoto, photoObject } from "../lib/supporter-photo.js";
import { mediaViewer, setMediaSession } from "../lib/supporter-posts.js";
import { canSeePrivateSupporterAvatar } from "../lib/messaging.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PHOTO_LIMIT, files: 1 } }).single("file");
const uploading = new Set<string>();
const limit = rateLimit({ windowMs: 60_000, limit: 8, keyGenerator: req => req.user!.userId,
  message: { error: "Please wait a moment and try again" } });
const failure = (req: any, res: any, error: unknown) => {
  req.log?.warn({ status: error instanceof AccountError ? error.status : 503 }, "Supporter account operation failed");
  res.status(error instanceof AccountError ? error.status : 503).json({ error: error instanceof AccountError ? error.message : ACCOUNT_ERROR });
};
router.use("/supporter/account", requireAuth, (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  if (req.user!.accountType !== "supporter") { res.status(403).json({ error: ACCOUNT_ERROR }); return; }
  next();
});
router.get("/supporter/account", async (req, res) => {
  try {
    const token = await getServerToken(), uid = req.user!.userId;
    await rememberNotificationEmail(uid, req.user!.email, token);
    setMediaSession(req, res);
    res.json(GetSupporterAccountResponse.parse(accountView(await accountUser(uid, token), req.user!.email)));
  } catch (e) { failure(req, res, e); }
});
router.patch("/supporter/account/profile", async (req, res) => {
  const parsed = SaveSupporterAccountProfileBody.strict().safeParse(req.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    res.status(400).json({ error: field === "displayName" ? "Add a display name" :
      field === "bio" ? "Keep your bio to 160 characters" : ACCOUNT_ERROR }); return;
  }
  try {
    const token = await getServerToken(), uid = req.user!.userId;
    if (parsed.data.photoId) await validateOwnedPhoto(uid, parsed.data.photoId);
    await saveAccountProfile(uid, parsed.data, token);
    setMediaSession(req, res);
    res.json(SaveSupporterAccountProfileResponse.parse(accountView(await accountUser(uid, token), req.user!.email)));
  } catch (e) { failure(req, res, e); }
});
router.patch("/supporter/account/settings", async (req, res) => {
  const parsed = SaveSupporterAccountSettingsBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: ACCOUNT_ERROR }); return; }
  try {
    const token = await getServerToken(), uid = req.user!.userId;
    await rememberNotificationEmail(uid, req.user!.email, token);
    await saveAccountSetting(uid, parsed.data, token);
    res.json(SaveSupporterAccountSettingsResponse.parse(accountView(await accountUser(uid, token), req.user!.email)));
  } catch (e) { failure(req, res, e); }
});
router.post("/supporter/account/photo", limit, async (req, res) => {
  const uid = req.user!.userId;
  if (uploading.has(uid) || uploading.size >= 3) { res.status(429).json({ error: "Please wait a moment and try again" }); return; }
  uploading.add(uid);
  try {
    await new Promise<void>((resolve, reject) => upload(req, res, err => err ? reject(err) : resolve()));
    if (!req.file) throw new AccountError(400, "Choose a square JPG or PNG photo");
    await accountUser(uid, await getServerToken());
    const result = await stagePhoto(uid, req.file.buffer, req.file.mimetype);
    setMediaSession(req, res);
    res.json(UploadSupporterAccountPhotoResponse.parse(result));
  } catch (e) {
    failure(req, res, e instanceof multer.MulterError ? new AccountError(400,
      e.code === "LIMIT_FILE_SIZE" ? "Use a photo smaller than 20 MB" : "Choose a square JPG or PNG photo") : e);
  } finally { uploading.delete(uid); }
});
router.delete("/supporter/account/photo/:photoId", async (req, res) => {
  const parsed = DiscardSupporterAccountPhotoParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: ACCOUNT_ERROR }); return; }
  try {
    const uid = req.user!.userId, user = await accountUser(uid, await getServerToken());
    if (user.avatarPhotoId !== parsed.data.photoId) {
      const file = photoObject(parsed.data.photoId);
      const [exists] = await file.exists();
      if (exists) await (await validateOwnedPhoto(uid, parsed.data.photoId)).delete({ ignoreNotFound: true });
    }
    res.sendStatus(204);
  } catch (e) { failure(req, res, e); }
});

// Use the existing read-only media cookie and logout clearing, not a new token.
// This route is mounted before the generic post-media route.
router.get("/supporter-posts/media/avatars/:photoId", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const photoId = String(req.params.photoId);
  if (!PHOTO_ID.test(photoId)) { res.status(404).end(); return; }
  try {
    const token = await getServerToken(), viewer = mediaViewer(req);
    const file = photoObject(photoId);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).end(); return; }
    const [metadata] = await file.getMetadata();
    const uid = metadata.metadata?.ownerUid;
    if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) { res.status(404).end(); return; }
    const owner = await fsGet("users", uid, token);
    if (!owner || owner.accountType !== "supporter") { res.status(404).end(); return; }
    if (owner.avatarPhotoId === photoId) {
      const pp = owner.publicProfile as { enabled?: boolean } | undefined;
      if (viewer !== uid && pp?.enabled !== true && (!viewer || !await canSeePrivateSupporterAvatar(viewer, uid, token))) {
        res.status(404).end(); return;
      }
    } else {
      // An unattached draft is visible only in its owner's authenticated media session.
      if (viewer !== uid) { res.status(404).end(); return; }
    }
    res.type("image/jpeg");
    file.createReadStream().on("error", () => {
      if (!res.headersSent) res.status(503).json({ error: ACCOUNT_ERROR }); else res.destroy();
    }).pipe(res);
  } catch (e) { failure(req, res, e); }
});
export default router;
