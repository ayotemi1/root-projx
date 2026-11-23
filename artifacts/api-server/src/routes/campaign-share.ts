import { Router } from "express";
import { campaignSharePath, findPublicCampaign } from "./organisations.js";

const router = Router();

// /campaigns belongs to this API artifact for crawler metadata. Payment
// returns are browser pages, so hand them to the frontend-owned /campaign path
// before the two-slug crawler route can mistake "thank-you" for a campaign.
for (const suffix of ["/thank-you/share", "/thank-you", ""]) {
  router.get(`/campaigns/:publicId${suffix}`, (req, res) => {
    const id = encodeURIComponent(String(req.params.publicId));
    const search = new URLSearchParams();
    for (const key of ["session_id", "amount", "cover"]) {
      if (typeof req.query[key] === "string") search.set(key, req.query[key] as string);
    }
    const query = search.toString();
    res.set("Cache-Control", "no-store").redirect(302, `/campaign/${id}${suffix}${query ? `?${query}` : ""}`);
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

router.get("/campaigns/:organisationSlug/:campaignSlug", async (req, res) => {
  try {
    const organisationSlug = String(req.params.organisationSlug);
    const campaignSlug = String(req.params.campaignSlug);
    const landing = await findPublicCampaign((candidate, org) => {
      const share = campaignSharePath(org, candidate);
      return share.organisationSlug === organisationSlug && share.campaignSlug === campaignSlug;
    });

    if (!landing) {
      res.status(404).send("Campaign not found");
      return;
    }

    const campaign = landing.campaign as Record<string, unknown>;
    const organisation = landing.organisation as Record<string, unknown>;
    const origin = `${req.protocol}://${req.get("host")}`;
    const canonicalUrl = `${origin}/campaigns/${encodeURIComponent(organisationSlug)}/${encodeURIComponent(campaignSlug)}`;
    const appUrl = `/campaign/${encodeURIComponent(organisationSlug)}/${encodeURIComponent(campaignSlug)}`;
    const image = campaign["imageUrl"]
      ? new URL(String(campaign["imageUrl"]), origin).href
      : organisation["logo"]
        ? new URL(String(organisation["logo"]), origin).href
        : `${origin}/opengraph.jpg`;
    const title = `${String(campaign["name"] ?? "Campaign")} — ${String(organisation["name"] ?? "Organisation")}`;
    const description = String(campaign["tagline"] || campaign["description"] || "").slice(0, 200);

    res
      .status(200)
      .type("html")
      .set("Cache-Control", "public, max-age=300")
      .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}">
</head>
<body>
  <p>Opening ${escapeHtml(String(campaign["name"] ?? "campaign"))}…</p>
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`);
  } catch (err) {
    req.log.error({ err }, "campaign share page error");
    res.status(500).send("Campaign unavailable");
  }
});

export default router;