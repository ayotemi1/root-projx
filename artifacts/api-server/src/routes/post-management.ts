import { Router } from "express";
import { ManageOwnPostBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth.js";
import { getServerToken } from "../lib/firebase-rest.js";
import { PostError, setMediaSession } from "../lib/supporter-posts.js";
import { postManagement } from "../lib/post-management.js";

const router = Router();
router.use("/post-management", requireAuth, (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store"); res.vary("Authorization"); next();
});
function fail(res: any, error: unknown) {
  const status = error instanceof PostError ? error.status : 503;
  res.status(status).json({ error: error instanceof PostError && status === 409 ? error.message : "We couldn't save this post. Please try again." });
}
router.get("/post-management/archived", async (req, res) => {
  try { setMediaSession(req, res); res.json(await postManagement.archived(req.user!.userId, await getServerToken())); }
  catch (e) { fail(res, e); }
});
router.get("/post-management/:kind/:id", async (req, res) => {
  try { setMediaSession(req, res); res.json(await postManagement.details(String(req.params.kind), String(req.params.id), req.user!.userId, await getServerToken())); }
  catch (e) { fail(res, e); }
});
router.patch("/post-management/:kind/:id", async (req, res) => {
  const input = ManageOwnPostBody.strict().safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Choose a valid post change. Published photos and videos cannot be replaced." }); return; }
  try { res.json(await postManagement.change(String(req.params.kind), String(req.params.id), req.user!.userId, input.data, await getServerToken())); }
  catch (e) { fail(res, e); }
});
export default router;
