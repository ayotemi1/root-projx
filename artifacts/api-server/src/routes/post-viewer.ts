import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { GetPostViewerResponse, GetPostActivityResponse, SetPostLikeBody, AddPostCommentBody, SetPostCommentLikeBody } from "@workspace/api-zod";
import { optionalAuth, requireAuth } from "../lib/auth.js";
import { getServerToken } from "../lib/firebase-rest.js";
import { PostError, POST_ERROR, setMediaSession } from "../lib/supporter-posts.js";
import { postInteractions } from "../lib/post-interactions.js";

const router = Router();
router.use("/post-viewer", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  next();
});
const limit = rateLimit({ windowMs: 60_000, limit: 90, keyGenerator: req => req.user!.userId,
  standardHeaders: "draft-7", legacyHeaders: false, message: { error: POST_ERROR } });
const root = "/post-viewer/:kind/:id";
function fail(req: Request, res: Response, error: unknown) {
  const status = error instanceof PostError ? error.status : 503;
  req.log.warn({ status }, "Post viewer operation failed");
  res.status(status).json({ error: POST_ERROR });
}
router.get(root, optionalAuth, async (req, res) => {
  try {
    const { kind, id } = req.params as { kind: string; id: string };
    const { record } = await postInteractions.visible(kind, id, req.user?.userId ?? null, await getServerToken());
    if (req.user?.accountType === "supporter") setMediaSession(req, res);
    res.json(GetPostViewerResponse.parse(record));
  } catch (e) { fail(req, res, e); }
});
router.get(`${root}/activity`, optionalAuth, async (req, res) => {
  try {
    const { kind, id } = req.params as { kind: string; id: string };
    res.json(GetPostActivityResponse.parse(await postInteractions.activity(kind, id, req.user?.userId ?? null, await getServerToken())));
  } catch (e) { fail(req, res, e); }
});
router.put(`${root}/like`, requireAuth, limit, async (req, res) => {
  const body = SetPostLikeBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: POST_ERROR }); return; }
  try {
    const { kind, id } = req.params as { kind: string; id: string };
    res.json(GetPostActivityResponse.parse(await postInteractions.like(kind, id, req.user!.userId, body.data.liked, await getServerToken())));
  } catch (e) { fail(req, res, e); }
});
router.post(`${root}/comments`, requireAuth, limit, async (req, res) => {
  const body = AddPostCommentBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: POST_ERROR }); return; }
  try {
    const { kind, id } = req.params as { kind: string; id: string };
    res.json(GetPostActivityResponse.parse(await postInteractions.comment(kind, id, req.user!.userId, body.data, await getServerToken())));
  } catch (e) { fail(req, res, e); }
});
router.put(`${root}/comments/:commentId/like`, requireAuth, limit, async (req, res) => {
  const body = SetPostCommentLikeBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: POST_ERROR }); return; }
  try {
    const { kind, id, commentId } = req.params as { kind: string; id: string; commentId: string };
    res.json(GetPostActivityResponse.parse(await postInteractions.like(kind, id, req.user!.userId, body.data.liked, await getServerToken(), commentId)));
  } catch (e) { fail(req, res, e); }
});
export default router;
