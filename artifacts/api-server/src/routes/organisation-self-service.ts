import { Router } from "express";
import type { RequestHandler } from "express";
import { requireAuth, requireApprovedOrganisation } from "../lib/auth.js";
import { fsGet, fsPatch, fsQuery, getServerToken } from "../lib/firebase-rest.js";
import { activePayoutMethod } from "../lib/payout-setup.js";
import { campaignForEditor } from "../lib/campaign-editor.js";
import { campaignSupporters, summariseSupporters } from "../lib/campaign-supporters.js";
import { walkthroughPatch, walkthroughState } from "../lib/walkthrough.js";
import { publicCampaignFields } from "./organisations.js";

const router = Router();
const owner: RequestHandler[] = [requireAuth, requireApprovedOrganisation, (req, res, next) => {
  if (req.params.id !== req.user!.userId) { res.status(403).json({ error: "Open your own organisation dashboard to continue." }); return; }
  res.setHeader("Cache-Control", "no-store");
  next();
}];
const campaignsOf = (org: Record<string, unknown>) => Array.isArray(org.campaigns) ? org.campaigns as Record<string, unknown>[] : [];

router.get("/organisations/:id/campaigns/:campId/preview", ...owner, async (req, res) => {
  try {
    const token = await getServerToken();
    const org = await fsGet("organisations", String(req.params.id), token);
    const campaign = org && campaignsOf(org).find(c => c._id === req.params.campId && c.status !== "deleted");
    if (!org || !campaign) { res.status(404).json({ error: "Open an existing campaign draft from your dashboard." }); return; }
    const { campaigns: _campaigns, walkthrough: _walkthrough, ...profile } = org;
    // Explicit public profile projection: never include payee/provider credentials.
    const organisation = Object.fromEntries(["name", "country", "city", "category", "description", "shortDescription", "mission", "logo", "coverImage", "verified", "team"]
      .map(key => [key, profile[key] ?? null]));
    res.json({ campaign: { ...publicCampaignFields(campaignForEditor(campaign), String(req.params.id)),
      ...await campaignSupporters(String(req.params.id), String(req.params.campId), token, org.supporterWall) },
      organisation: { ...organisation, _id: req.params.id }, preview: true });
  } catch (err) {
    req.log.error({ err }, "Owner campaign preview failed");
    res.status(503).json({ error: "Keep your draft open and retry the preview." });
  }
});

router.get("/organisations/:id/walkthrough", ...owner, async (req, res) => {
  try {
    const org = await fsGet("organisations", String(req.params.id), await getServerToken());
    if (!org) { res.status(404).json({ error: "Your organisation profile could not be found. Reopen your dashboard." }); return; }
    res.json({ walkthrough: walkthroughState(org), profilePreviewedAt: org.profilePreviewedAt ?? null,
      campaignPreviewedAt: org.campaignPreviewedAt ?? null, campaignPreviewedId: org.campaignPreviewedId ?? null,
      payoutSetupSelected: activePayoutMethod(org) !== null });
  } catch (err) {
    req.log.error({ err }, "Load walkthrough failed");
    res.status(503).json({ error: "Your saved work is safe. Retry loading the walkthrough." });
  }
});
router.patch("/organisations/:id/walkthrough", ...owner, async (req, res) => {
  try {
    const token = await getServerToken();
    const org = await fsGet("organisations", String(req.params.id), token);
    if (!org) { res.status(404).json({ error: "Reopen your organisation dashboard." }); return; }
    let progress;
    try { progress = walkthroughPatch(org, req.body); }
    catch (err) { res.status(400).json({ error: (err as Error).message }); return; }
    await fsPatch("organisations", String(req.params.id), { walkthrough: progress }, token);
    res.json({ walkthrough: progress });
  } catch (err) {
    req.log.error({ err }, "Save walkthrough failed");
    res.status(503).json({ error: "Keep this page open and retry saving your place. Your profile and campaign drafts are unchanged." });
  }
});
router.post("/organisations/:id/walkthrough/events", ...owner, async (req, res) => {
  try {
    const { event, campaignId } = req.body ?? {};
    if (!["profile_preview", "campaign_preview"].includes(event)) { res.status(400).json({ error: "Open the profile or campaign donor preview to continue." }); return; }
    const token = await getServerToken();
    const org = await fsGet("organisations", String(req.params.id), token);
    if (!org) { res.status(404).json({ error: "Reopen your organisation dashboard." }); return; }
    if (event === "campaign_preview" && !campaignsOf(org).some(c => c._id === campaignId && c.status !== "deleted")) {
      res.status(404).json({ error: "Open one of your own campaign previews." }); return;
    }
    const at = new Date().toISOString();
    await fsPatch("organisations", String(req.params.id), event === "profile_preview" ? { profilePreviewedAt: at }
      : { campaignPreviewedAt: at, campaignPreviewedId: campaignId }, token);
    res.json({ recorded: true, at });
  } catch (err) {
    req.log.error({ err }, "Preview interaction could not be saved");
    res.status(503).json({ error: "Retry opening the preview to save this walkthrough step." });
  }
});

router.get("/organisations/:id/dashboard-summary", ...owner, async (req, res) => {
  try {
    const id = String(req.params.id);
    const token = await getServerToken();
    const org = await fsGet("organisations", id, token);
    if (!org) { res.status(404).json({ error: "Reopen your organisation dashboard." }); return; }
    const filter = [{ field: "orgId", op: "EQUAL" as const, value: id }];
    // A denied history query must not discard confirmed raised totals/supporters.
    const results = await Promise.allSettled([
      fsQuery("donations", filter, token), fsQuery("payouts", filter, token),
      fsQuery("disbursements", filter, token), fsQuery("updates", filter, token),
    ]);
    const sections = ["supporters", "payouts", "payoutHistory", "posts"] as const;
    const unavailable: string[] = [];
    const readSection = (i: 0 | 1 | 2 | 3) => {
      const result = results[i];
      if (result.status === "fulfilled") return result.value;
      unavailable.push(sections[i]!);
      req.log.error({ err: result.reason, section: sections[i], orgId: id }, "Organisation summary section unavailable");
      return [];
    };
    const donations = readSection(0), payouts = readSection(1), transfers = readSection(2), updates = readSection(3);
    const roundedSum = (rows: Record<string, unknown>[]) => rows.reduce((p, row) =>
      p + (typeof row.amountGbp === "number" && Number.isFinite(row.amountGbp) ? Math.round(row.amountGbp * 100) : 0), 0) / 100;
    const unpaid = payouts.filter(p => !["sent", "refunded", "canceled", "cancelled", "void"].includes(String(p.status)));
    const sent = payouts.filter(p => p.status === "sent").sort((a, b) => String(b.sentAt ?? "").localeCompare(String(a.sentAt ?? "")));
    const latest = sent[0];
    const batch = latest ? sent.filter(p => latest.batchId ? p.batchId === latest.batchId : p._id === latest._id) : [];
    let lastPayout = latest ? { amountGbp: roundedSum(batch), sentAt: String(latest.sentAt ?? ""),
      reference: String(latest.reference ?? (latest.wiseTransferId ? `Wise transfer ${latest.wiseTransferId}` : latest.batchId ?? latest._id)) } : null;
    const disbursement = [...transfers].sort((a, b) => String(b.disbursedAt ?? "").localeCompare(String(a.disbursedAt ?? "")))[0];
    if (disbursement && (!lastPayout || String(disbursement.disbursedAt) > lastPayout.sentAt)) {
      lastPayout = { amountGbp: Number(disbursement.amountGbp), sentAt: String(disbursement.disbursedAt),
        reference: String(disbursement.reference ?? `Wise transfer ${disbursement.transferId}`) };
    }
    const dates = updates.map(u => typeof u.createdAt === "string" ? u.createdAt : "").filter(Boolean).sort().reverse();
    const metrics = org.impactMetrics && typeof org.impactMetrics === "object" ? Object.values(org.impactMetrics) : [];
    // The active goal is the fourth impact figure and also needs a monthly refresh.
    const refreshableMetrics = org.activeGoal && typeof org.activeGoal === "object" ? [...metrics, org.activeGoal] : metrics;
    const staleBefore = Date.now() - 30 * 86_400_000;
    const nextPayoutAt = typeof org.nextPayoutAt === "string" && Number.isFinite(Date.parse(org.nextPayoutAt)) && Date.parse(org.nextPayoutAt) >= Date.now() ? org.nextPayoutAt : null;
    res.json({ raisedGbp: Number(org.totalRaised ?? 0),
      owedGbp: unavailable.includes("payouts") ? null : roundedSum(unpaid), nextPayoutAt,
      lastPayout: unavailable.includes("payouts") || unavailable.includes("payoutHistory") ? null : lastPayout,
      unavailable,
      ...(unavailable.includes("supporters") ? { recentSupporters: [] } : summariseSupporters(donations, org.supporterWall)),
      campaignRaised: campaignsOf(org).filter(c => c.status !== "deleted").map(c => ({
        campaignId: String(c._id), name: String(c.name ?? ""), raisedGbp: Number(c.amountRaised ?? 0) })),
      latestUpdateAt: dates[0] ?? null,
      impactMetricsStale: !metrics.length || refreshableMetrics.some(m => !m || typeof m !== "object" || !("updatedAt" in m) ||
        !Number.isFinite(Date.parse(String(m.updatedAt))) || Date.parse(String(m.updatedAt)) < staleBefore),
    });
  } catch (err) {
    req.log.error({ err }, "Organisation running summary failed");
    res.status(503).json({ error: "We could not load your balances and activity. Retry; no zero balance has been substituted." });
  }
});
export default router;
