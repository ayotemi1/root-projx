import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import {
  PublishSupporterPostBody, RequestSupporterPostUploadBody, CompleteSupporterPostUploadBody,
} from "@workspace/api-zod";
import { optionalAuth, requireAuth } from "../lib/auth.js";
import { fsGet, fsPatch, fsQuery, fsDelete, fsPublishSupporterPost, getServerToken } from "../lib/firebase-rest.js";
import {
  POSTS, MEDIA, FOLLOWERS, UUID, POST_ERROR, PostError, fingerprint, canSeePost,
  matchesPostInterests, postDto, publicSupporter, setMediaSession, clearMediaSession, mediaViewer,
} from "../lib/supporter-posts.js";
import { requestPostUpload, completePostUpload, mediaObject } from "../lib/supporter-post-uploads.js";
import { isCampaignPublished } from "../lib/campaign-publication.js";

const router = Router();
const noStore = (_req: Request, res: Response, next: () => void) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
};
router.use("/supporter-posts", noStore);
const supporter = (req: Request, res: Response, next: () => void) => {
  if (req.user?.accountType !== "supporter") { res.status(403).json({ error: POST_ERROR }); return; }
  next();
};
const uploadLimit = rateLimit({
  windowMs: 3600_000, limit: 60, keyGenerator: req => req.user!.userId,
  standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "You’ve reached the upload limit for this hour. Please try again later." },
});
const completionLimit = rateLimit({
  windowMs: 60_000, limit: 120, keyGenerator: req => req.user!.userId,
  standardHeaders: "draft-7", legacyHeaders: false, message: { error: POST_ERROR },
});
function fail(req: Request, res: Response, error: unknown) {
  // Neither captions, private URLs nor raw storage/decoder errors are logged.
  req.log?.warn({ status: error instanceof PostError ? error.status : 503 }, "Supporter post operation failed");
  if (!res.headersSent) res.status(error instanceof PostError ? error.status : 503)
    .json({ error: error instanceof PostError ? error.message : POST_ERROR });
  else res.destroy();
}

router.delete("/supporter-posts/media-session", (req, res) => { clearMediaSession(req, res); res.sendStatus(204); });
router.post("/supporter-posts/uploads/request", requireAuth, supporter, uploadLimit, async (req, res) => {
  const body = RequestSupporterPostUploadBody.strict().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Choose a JPG, PNG or HEIC photo up to 20 MB, or an MP4 or MOV video up to 500 MB and 10 minutes." }); return;
  }
  try { res.json(await requestPostUpload(req.user!.userId, body.data)); }
  catch (error) { fail(req, res, error); }
});
router.post("/supporter-posts/uploads/complete", requireAuth, supporter, completionLimit, async (req, res) => {
  const body = CompleteSupporterPostUploadBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: POST_ERROR }); return; }
  try {
    setMediaSession(req, res);
    const processing = Symbol("processing");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      completePostUpload(req.user!.userId, body.data.objectPath),
      new Promise<typeof processing>(resolve => { timer = setTimeout(() => resolve(processing), 1500); timer.unref(); }),
    ]).finally(() => { if (timer) clearTimeout(timer); });
    if (result === processing) res.status(202).json({ processing: true });
    else res.json(result);
  } catch (error) { fail(req, res, error); }
});

router.get("/supporter-posts", optionalAuth, async (req, res) => {
  try {
    const viewer = req.user?.accountType === "supporter" ? req.user.userId : null;
    const feed = req.query.feed ?? "for-you";
    if (!["mine", "following", "for-you"].includes(String(feed))) throw new PostError(400);
    if (!req.query.publicId && feed !== "for-you" && !viewer) throw new PostError(401);
    const token = await getServerToken();
    setMediaSession(req, res);
    let authorId: string | null = null;
    if (req.query.publicId) {
      const author = await publicSupporter(String(req.query.publicId), token);
      if (!author) throw new PostError(404);
      authorId = String(author._id);
    } else if (feed === "mine") authorId = viewer;
    const rows = await fsQuery(POSTS,
      authorId ? [{ field: "author_id", op: "EQUAL", value: authorId }] : [],
      token, authorId ? { limit: 200 } : { orderBy: { field: "created_at", dir: "DESCENDING" }, limit: 200 });
    const follows = feed === "following" && !authorId
      ? await fsQuery(FOLLOWERS, [{ field: "follower_id", op: "EQUAL", value: viewer }], token) : [];
    const following = new Set(follows.map(f => f.author_id));
    const me = viewer ? await fsGet("users", viewer, token) : null;
    const interests = Array.isArray(me?.interests) ? me.interests.filter((v): v is string => typeof v === "string") : [];
    const authorCache = new Map<string, Record<string, any> | null>();
    const orgCache = new Map<string, Record<string, any> | null>();
    const output = [];
    for (const post of rows) {
      const uid = String(post.author_id);
      if (!authorCache.has(uid)) authorCache.set(uid, await fsGet("users", uid, token));
      const author = authorCache.get(uid)!;
      if (!canSeePost(post, author, viewer)) continue;
      if (!authorId && feed === "following" && uid !== viewer && !following.has(uid)) continue;
      if (!authorId && feed === "for-you" && uid !== viewer) {
        const orgId = typeof post.organisation_id === "string" ? post.organisation_id : "";
        if (orgId && !orgCache.has(orgId)) orgCache.set(orgId, await fsGet("organisations", orgId, token));
        if (!matchesPostInterests(post, interests, orgCache.get(orgId) ?? null)) continue;
      }
      output.push(await postDto(post, viewer, token, author!));
    }
    res.json(output.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 100));
  } catch (error) { fail(req, res, error); }
});

router.post("/supporter-posts", requireAuth, supporter, async (req, res) => {
  const body = PublishSupporterPostBody.strict().safeParse(req.body);
  if (!body.success || !UUID.test(body.data.id)) { res.status(400).json({ error: POST_ERROR }); return; }
  const input = body.data;
  if (input.media.some((m, i) => !UUID.test(m.id) || m.order !== i) ||
      new Set(input.media.map(m => m.id)).size !== input.media.length ||
      (input.type === "text" ? !input.caption.trim() || input.media.length !== 0 : input.media.length === 0)) {
    res.status(400).json({ error: POST_ERROR }); return;
  }
  try {
    const uid = req.user!.userId;
    const token = await getServerToken();
    setMediaSession(req, res);
    const hash = fingerprint(input);
    const existing = await fsGet(POSTS, input.id, token);
    if (existing) {
      if (existing.author_id !== uid || existing.removed || existing.fingerprint !== hash) throw new PostError(409);
      res.status(201).json(await postDto(existing, uid, token)); return;
    }
    if (input.campaign_id && !input.organisation_id) throw new PostError(400);
    if (input.organisation_id) {
      if (input.organisation_id.includes("/")) throw new PostError(400);
      const org = await fsGet("organisations", input.organisation_id, token);
      if (!org) throw new PostError(400);
      if (input.campaign_id && !(Array.isArray(org.campaigns) && org.campaigns.some((c: any) =>
        (c.id === input.campaign_id || c._id === input.campaign_id) && isCampaignPublished(c))))
        throw new PostError(400);
    }
    const media = await Promise.all(input.media.map(m => fsGet(MEDIA, m.id, token)));
    if (media.some(m => !m || m.author_id !== uid || m.state !== "ready" || m.post_id)) throw new PostError(400);
    if (media.length && media[0]?.type !== input.type) throw new PostError(400);
    const post = {
      id: input.id, author_id: uid, type: input.type, caption: input.caption,
      community_tag: input.community_tag?.trim() || null, organisation_id: input.organisation_id || null,
      campaign_id: input.campaign_id || null, created_at: new Date().toISOString(),
      edited_at: null, removed: false, media_ids: input.media.map(m => m.id), fingerprint: hash,
    };
    try { await fsPublishSupporterPost(post, input.media, token); }
    catch (error) {
      // A concurrent identical retry can have committed while this request was
      // awaiting its write. Return that record; never create another post ID.
      const committed = await fsGet(POSTS, input.id, token);
      if (!committed || committed.author_id !== uid || committed.fingerprint !== hash || committed.removed) throw error;
    }
    res.status(201).json(await postDto((await fsGet(POSTS, input.id, token))!, uid, token));
  } catch (error) { fail(req, res, error); }
});

router.get("/supporter-posts/follows/:publicId", optionalAuth, async (req, res) => {
  try {
    const token = await getServerToken();
    const author = await publicSupporter(String(req.params.publicId), token);
    if (!author) throw new PostError(404);
    res.json({ following: !!req.user && !!await fsGet(FOLLOWERS, `${req.user.userId}_${author._id}`, token) });
  } catch (error) { fail(req, res, error); }
});
for (const method of ["post", "delete"] as const) {
  router[method]("/supporter-posts/follows/:publicId", requireAuth, supporter, async (req, res) => {
    try {
      const token = await getServerToken();
      const author = await publicSupporter(String(req.params.publicId), token);
      if (!author || author._id === req.user!.userId) throw new PostError(400);
      const id = `${req.user!.userId}_${author._id}`;
      if (method === "post") await fsPatch(FOLLOWERS, id, {
        follower_id: req.user!.userId, author_id: author._id, created_at: new Date().toISOString(),
      }, token);
      else await fsDelete(FOLLOWERS, id, token);
      res.json({ following: method === "post" });
    } catch (error) { fail(req, res, error); }
  });
}
router.delete("/supporter-posts/:id", requireAuth, supporter, async (req, res) => {
  try {
    if (!UUID.test(String(req.params.id))) throw new PostError(404);
    const token = await getServerToken();
    const post = await fsGet(POSTS, String(req.params.id), token);
    if (!post || post.author_id !== req.user!.userId) throw new PostError(404);
    await fsPatch(POSTS, String(req.params.id), { removed: true, edited_at: new Date().toISOString() }, token);
    res.sendStatus(204);
  } catch (error) { fail(req, res, error); }
});

const serveMedia = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!UUID.test(id)) throw new PostError(404);
    const token = await getServerToken();
    const media = await fsGet(MEDIA, id, token);
    if (!media || media.state !== "ready") throw new PostError(404);
    const viewer = mediaViewer(req);
    const post = media.post_id ? await fsGet(POSTS, String(media.post_id), token) : null;
    const author = await fsGet("users", String(media.author_id), token);
    if (!author || author.accountType !== "supporter") throw new PostError(404);
    if (post ? post.author_id !== media.author_id || !canSeePost(post, author, viewer) || !(post.media_ids as string[])?.includes(id)
      : viewer !== media.author_id) throw new PostError(404);
    const thumbnail = req.path.endsWith("/thumbnail");
    const path = thumbnail ? media.thumbnail_path : media.storage_path;
    if (typeof path !== "string" || !path.startsWith(`supporter-private/${media.author_id}/${id}/`)) throw new PostError(404);
    const file = await mediaObject(path);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    res.setHeader("Content-Type", thumbnail ? "image/jpeg" : String(media.content_type));
    res.setHeader("Accept-Ranges", "bytes");
    let start = 0; let end = size - 1;
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) { res.setHeader("Content-Range", `bytes */${size}`); res.sendStatus(416); return; }
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : end; }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
        res.setHeader("Content-Range", `bytes */${size}`); res.sendStatus(416); return;
      }
      res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    }
    res.setHeader("Content-Length", end - start + 1);
    const stream = file.createReadStream({ start, end });
    res.on("close", () => stream.destroy());
    stream.on("error", error => fail(req, res, error));
    stream.pipe(res);
  } catch (error) { fail(req, res, error); }
};
router.get("/supporter-posts/media/:id/thumbnail", optionalAuth, serveMedia);
router.get("/supporter-posts/media/:id", optionalAuth, serveMedia);
export default router;
