import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, requireApprovedOrganisation } from "../lib/auth.js";
import { fsGet, getServerToken } from "../lib/firebase-rest.js";
import { campaignForEditor } from "../lib/campaign-editor.js";
import { suggest } from "../lib/campaign-assist.js";

const router = Router();
const enabled = () => process.env.CAMPAIGN_ASSIST_ENABLED === "true";
router.get("/campaigns/assist/status", requireAuth, requireApprovedOrganisation, (_req, res) => {
  res.json({ enabled: enabled() });
});
router.post("/campaigns/assist", requireAuth, requireApprovedOrganisation,
  rateLimit({ windowMs: 60_000, limit: 10, keyGenerator: req => req.user!.userId, standardHeaders: "draft-7", legacyHeaders: false,
    message: { error: "Please wait a minute before requesting another writing suggestion." } }),
  async (req, res) => {
    const { campaignId, field, instruction } = req.body ?? {};
    if (typeof campaignId !== "string" || !["tagline", "description", "breakdown.detail", "locations.description"].includes(field) ||
      typeof instruction !== "string" || instruction.length > 1000) {
      res.status(400).json({ error: "Choose a campaign text field and keep your instruction under 1,000 characters." }); return;
    }
    try {
      const token = await getServerToken();
      const org = await fsGet("organisations", req.user!.userId, token);
      const campaign = (Array.isArray(org?.campaigns) ? org.campaigns as Record<string, unknown>[] : [])
        .find(c => c._id === campaignId && c.status !== "deleted");
      if (!org || !campaign) { res.status(404).json({ error: "Open one of your own campaign drafts to request writing help." }); return; }
      if (!enabled()) { res.status(503).json({ unavailable: true, error: "Writing help is not configured. You can continue writing and saving your campaign yourself." }); return; }
      const orgContext = Object.fromEntries(["name", "shortDescription", "description", "mission", "country", "city", "categories"]
        .map(k => [k, org[k]]));
      const editor = campaignForEditor(campaign);
      const campaignDraft = Object.fromEntries(["name", "tagline", "type", "goal", "deadline", "description",
        "partnerFunding", "breakdown", "locations", "imageUrl", "video", "theme"].map(key => [key, editor[key]]));
      const result = await suggest({ field, orgContext, campaignDraft, instruction });
      if ("unavailable" in result) { res.status(503).json({ ...result, error: "Writing help is not configured. Continue writing your campaign yourself." }); return; }
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "Campaign writing help failed");
      res.status(503).json({ unavailable: true, error: "Writing help is unavailable. Continue writing yourself and try again later." });
    }
  });
export default router;
