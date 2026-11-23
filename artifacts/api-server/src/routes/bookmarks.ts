import { Router } from "express";
import { ListBookmarksResponse, SaveBookmarkBody, SaveBookmarkResponse, RemoveBookmarkParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth.js";
import { fsGet, fsMutateSupporterShowcase, getServerToken } from "../lib/firebase-rest.js";
import { POST_ERROR, PostError, setMediaSession } from "../lib/supporter-posts.js";
import { bookmarkReferences, resolveBookmark, saveReference } from "../lib/bookmarks.js";

const router = Router();
router.use("/bookmarks", requireAuth, (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  if (req.user!.accountType !== "supporter") { res.status(403).json({ error: POST_ERROR }); return; }
  next();
});
const fail = (req: any, res: any, error: unknown) => {
  req.log?.warn("Private bookmark operation failed");
  res.status(error instanceof PostError ? error.status : 503).json({ error: POST_ERROR });
};
router.get("/bookmarks", async (req, res) => {
  try {
    const token = await getServerToken(), uid = req.user!.userId;
    const user = await fsGet("users", uid, token);
    if (!user || user.accountType !== "supporter") throw new PostError(403);
    setMediaSession(req, res);
    const refs = bookmarkReferences(user);
    // Small batches bound simultaneous provider requests even for large lists.
    const result = [];
    for (let i = 0; i < refs.length; i += 12) result.push(...await Promise.all(refs.slice(i, i + 12).map(r => resolveBookmark(r, uid, token))));
    res.json(ListBookmarksResponse.parse(result));
  } catch (e) { fail(req, res, e); }
});
router.post("/bookmarks", async (req, res) => {
  const body = SaveBookmarkBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: POST_ERROR }); return; }
  try {
    const view = await saveReference(req.user!.userId, body.data, await getServerToken());
    setMediaSession(req, res);
    res.json(SaveBookmarkResponse.parse(view));
  } catch (e) { fail(req, res, e); }
});
router.delete("/bookmarks/:id", async (req, res) => {
  const params = RemoveBookmarkParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: POST_ERROR }); return; }
  try {
    await fsMutateSupporterShowcase(req.user!.userId, await getServerToken(), user => {
      if (user.accountType !== "supporter") throw new PostError(403);
      return { ...(user.profileShowcase ?? {}), bookmarks: bookmarkReferences(user).filter(b => b.id !== params.data.id) };
    });
    res.sendStatus(204);
  } catch (e) { fail(req, res, e); }
});
export default router;
