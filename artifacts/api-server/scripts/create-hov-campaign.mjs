/**
 * One-time, idempotent import of the user-supplied "Out of Many Hands" PDF.
 * Dry-run: node --experimental-strip-types artifacts/api-server/scripts/create-hov-campaign.mjs
 * Apply: add --apply. This creates an UNPUBLISHED campaign: the PDF does not
 * confirm a financial goal, exact committed sum, dates, photos, or donors.
 * Never manufacture financial totals or bypass the normal publish gates.
 */
import { fsGet, fsMutateCampaigns, fsPatch, getServerToken } from "../src/lib/firebase-rest.ts";
import { profilePatch } from "../src/lib/organisation-profile.ts";

const ORG_ID = "wjrO1hiK6gfS7og1KVSjs5euRlC2";
const CAMPAIGN_ID = "hov_out_of_many_hands";
const NAME = "Out of Many Hands";
const apply = process.argv.includes("--apply");
const now = new Date().toISOString();

const profileContent = {
  shortDescription: "Vocational training to help Jamaican communities rebuild livelihoods after Hurricane Melissa.",
  mission: "Help people rebuild livelihoods through practical skills training and opportunities to earn.",
  description: `Humanity Ova Vanity is planning vocational training in Jamaica to help people rebuild livelihoods after Hurricane Melissa. Emergency relief meets urgent needs; restoring work and income takes longer.

Its proposed three-month programme offers 30 training places across construction, wood processing and garment making. These are practical trades that participants can use to earn and to contribute to rebuilding their communities. The programme is intended to welcome women and men and include on-site childcare so parents can take part.

The first cohort and its dates are still to be confirmed. This description is about the planned programme, not a claim that training has already started or that outcomes have been achieved.`,
};

const story = `Hurricane Melissa damaged homes. It also damaged livelihoods: the work and income families depend on. Emergency relief meets urgent needs, but rebuilding economic stability takes longer and needs a different kind of support.

Humanity Ova Vanity is planning a three-month vocational training programme for 30 people. It is intended to welcome women and men, with on-site childcare so parents can take part.

Participants will develop practical skills in construction, wood processing and garment making. Construction and repair skills can help rebuild homes and community buildings. Wood processing includes working with timber and reclaiming usable wood after storm damage. Garment making covers cutting, sewing and finishing: skills people can use to earn independently or with others.

The skills, effort and ambition are already here. This programme aims to give people training and time to turn them into a living. Donations toward this cohort will support the training and childcare. The first cohort's dates and full funding figures still need to be confirmed.`;

const draft = {
  _id: CAMPAIGN_ID,
  orgId: ORG_ID,
  name: NAME,
  tagline: "Thirty people learning a trade after Hurricane Melissa, so they can earn a living again and help their communities rebuild.",
  description: story,
  type: "fundraising",
  goal: 0, // Unknown: must be entered and reviewed before publishing.
  amountRaised: 0, // Server-owned; not the 1,247 example handprints in the PDF.
  volunteersNeeded: 0,
  status: "active",
  enabled: false,
  deadline: null,
  imageUrl: null, // No real hero photograph supplied.
  partnerFunding: null, // Commitment mentioned in the PDF but exact amount is unknown.
  partnerFundingAnswer: null,
  partnerFundingMatchedGbp: 0,
  breakdown: [
    { label: "Practical training", detail: "Hands-on construction, wood-processing and garment-making skills." },
    { label: "On-site childcare", detail: "So parents can take part in training." },
  ],
  locations: [],
  phases: [],
  video: null,
  theme: {
    primaryColor: "#B50000",
    accentColor: "#F5B800",
    backgroundColor: "#FFF9F2",
    textColor: "#1A1A1A",
    unit: { singular: "hand", plural: "hands", imageUrl: "/campaign-units/hand.svg" },
  },
  unitChosen: true,
  editorStep: 2,
  createdAt: now,
  updatedAt: now,
};

const token = await getServerToken();
const org = await fsGet("organisations", ORG_ID, token);
if (!org || org.name !== "Humanity Ova Vanity" || org.country !== "Jamaica") {
  throw new Error("The expected organisation was not found; no changes were made.");
}

const profileInput = Object.fromEntries(Object.entries(profileContent).filter(
  ([field]) => typeof org[field] !== "string" || !org[field].trim(),
));
const profile = profilePatch(profileInput, org);
const campaigns = Array.isArray(org.campaigns) ? org.campaigns : [];
const existing = campaigns.find(c => c?._id === CAMPAIGN_ID || c?.name === NAME && c?.status !== "deleted");
if (!apply) {
  console.log(`Would ${existing ? "keep the existing" : "create an unpublished"} "${NAME}" campaign for Humanity Ova Vanity.`);
  console.log(`Would fill ${Object.keys(profile).length} empty profile fields. Funding goal, commitment, dates, hero image and payout remain unset.`);
} else {
  const result = await fsMutateCampaigns(ORG_ID, token, latest => {
    if (latest.name !== "Humanity Ova Vanity") throw new Error("Organisation identity changed; no campaign was added.");
    const current = Array.isArray(latest.campaigns) ? latest.campaigns : [];
    if (current.some(c => c?._id === CAMPAIGN_ID || c?.name === NAME && c?.status !== "deleted")) {
      return { campaigns: current, result: "already present" };
    }
    return { campaigns: [...current, draft], result: "created" };
  });
  // Refresh before patching: never replace profile text the owner wrote meanwhile.
  const fresh = await fsGet("organisations", ORG_ID, token);
  if (!fresh) throw new Error("Campaign saved, but organisation could not be reloaded; rerun to complete the profile.");
  const remaining = Object.fromEntries(Object.entries(profileContent).filter(
    ([field]) => typeof fresh[field] !== "string" || !fresh[field].trim(),
  ));
  const patch = profilePatch(remaining, fresh);
  if (Object.keys(patch).length) await fsPatch("organisations", ORG_ID, patch, token);
  console.log(`Campaign ${result}; unpublished. Filled ${Object.keys(patch).length} empty profile fields. Financial figures and payout were not changed.`);
}
