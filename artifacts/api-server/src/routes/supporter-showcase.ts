import { Router, type Request, type Response } from "express";
import {
  GetMySupporterShowcaseResponse, GetVisitorSupporterShowcaseResponse,
  SaveSupporterShowcaseDetailsBody, AddSupporterInvolvementBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth.js";
import { fsGet, fsMutateSupporterShowcase, getServerToken } from "../lib/firebase-rest.js";
import { POST_ERROR, PostError, publicSupporter, setMediaSession, UUID } from "../lib/supporter-posts.js";
import { supporterShowcase, entries } from "../lib/supporter-showcase.js";

const router = Router();
router.use("/supporter-showcase", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  next();
});
const supporter = (req: Request, res: Response, next: () => void) => {
  if (req.user?.accountType !== "supporter") { res.status(403).json({ error: POST_ERROR }); return; }
  next();
};
function fail(req: Request, res: Response, error: unknown) {
  const status = error instanceof PostError ? error.status : 503;
  req.log.warn({ status }, "Supporter profile operation failed");
  res.status(status).json({ error: POST_ERROR });
}
router.get("/supporter-showcase/me", requireAuth, supporter, async (req, res) => {
  try {
    const token = await getServerToken();
    const user = await fsGet("users", req.user!.userId, token);
    if (!user || user.accountType !== "supporter") throw new PostError(404);
    setMediaSession(req, res);
    res.json(GetMySupporterShowcaseResponse.parse(await supporterShowcase(user, req.user!.userId, token, true)));
  } catch (e) { fail(req, res, e); }
});
// Intentionally no optionalAuth: owner preview and all visitors receive the
// exact same projection. Private profiles are indistinguishable from missing.
router.get("/supporter-showcase/public/:publicId", async (req, res) => {
  try {
    const token = await getServerToken();
    const user = await publicSupporter(String(req.params.publicId), token);
    if (!user) throw new PostError(404);
    res.json(GetVisitorSupporterShowcaseResponse.parse(await supporterShowcase(user, String(user._id), token, false)));
  } catch (e) { fail(req, res, e); }
});
router.patch("/supporter-showcase/details", requireAuth, supporter, async (req, res) => {
  const body = SaveSupporterShowcaseDetailsBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Check the location and selected interests." }); return; }
  try {
    await fsMutateSupporterShowcase(req.user!.userId, await getServerToken(), user => {
      if (user.accountType !== "supporter") throw new PostError(403);
      const allowed = Array.isArray(user.interests) ? user.interests : [];
      if (body.data.visibleInterests.some(i => !allowed.includes(i))) throw new PostError(400);
      return { ...((user.profileShowcase ?? {}) as object), location: body.data.location.trim(),
        visibleInterests: [...new Set(body.data.visibleInterests)] };
    });
    res.sendStatus(204);
  } catch (e) { fail(req, res, e); }
});
router.post("/supporter-showcase/involvement", requireAuth, supporter, async (req, res) => {
  const body = AddSupporterInvolvementBody.strict().safeParse(req.body);
  if (!body.success || !body.data.projectName.trim() || !body.data.when.trim() ||
      body.data.organisationId && !/^[A-Za-z0-9_-]{1,128}$/.test(body.data.organisationId)) {
    res.status(400).json({ error: "Choose an activity and enter an organisation or project and when." }); return;
  }
  try {
    const token = await getServerToken();
    const linked = body.data.organisationId ? await fsGet("organisations", body.data.organisationId, token) : null;
    if (body.data.organisationId && (!linked || !linked.name)) throw new PostError(400);
    const entry = { ...body.data, organisationId: body.data.organisationId || null,
      projectName: linked ? String(linked.name) : body.data.projectName.trim(),
      details: body.data.details.trim(), when: body.data.when.trim(), createdAt: new Date().toISOString() };
    await fsMutateSupporterShowcase(req.user!.userId, token, user => {
      if (user.accountType !== "supporter") throw new PostError(403);
      const current = (user.profileShowcase ?? {}) as Record<string, unknown>;
      const list = entries(current);
      const old = list.find(e => e.id === entry.id);
      if (old) {
        // Response loss retries may not replace the original entry.
        if (["projectName", "organisationId", "activity", "details", "when", "shared"].some(k =>
          (old[k] ?? null) !== (entry[k as keyof typeof entry] ?? null))) throw new PostError(409);
        return current;
      }
      if (list.length >= 100) throw new PostError(400);
      return { ...current, entries: [...list, entry] };
    });
    res.sendStatus(201);
  } catch (e) { fail(req, res, e); }
});
router.delete("/supporter-showcase/involvement/:id", requireAuth, supporter, async (req, res) => {
  const id = String(req.params.id);
  if (!UUID.test(id)) { res.status(400).json({ error: POST_ERROR }); return; }
  try {
    await fsMutateSupporterShowcase(req.user!.userId, await getServerToken(), user => {
      if (user.accountType !== "supporter") throw new PostError(403);
      const current = (user.profileShowcase ?? {}) as Record<string, unknown>;
      // ID lookup is strictly inside the signed-in user's document. An ID
      // belonging to another supporter cannot select or mutate their entry.
      return { ...current, entries: entries(current).filter(e => e.id !== id) };
    });
    res.sendStatus(204);
  } catch (e) { fail(req, res, e); }
});
export default router;
