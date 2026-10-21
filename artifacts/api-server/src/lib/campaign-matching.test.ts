import assert from "node:assert/strict";
import test from "node:test";
import { campaignMatch, migrateCampaignPartnerFunding, partnerFundingFor } from "./campaign-matching.ts";

const matching = { amount: 100, funderName: "Foundation", type: "matching" as const };
test("committed money never multiplies a donation, irrespective of raised amount", () => {
  assert.deepEqual(campaignMatch(10, { ...matching, type: "committed" }, 0),
    { donationGbp: 10, matchedGbp: 0, programmeGbp: 10, availableGbp: 0 });
});
test("matching defaults to 1:1 and consumes only the remaining partner cap", () => {
  assert.equal(campaignMatch(10, matching, 0).programmeGbp, 20);
  assert.equal(campaignMatch(10, matching, 95).programmeGbp, 15);
  assert.equal(campaignMatch(10, matching, 100).programmeGbp, 10);
  assert.equal(campaignMatch(10, matching, 101).matchedGbp, 0);
  assert.equal(campaignMatch(10, null, 0).programmeGbp, 10);
});
test("custom ratio and cap use partner pounds, not donor pounds, with penny rounding", () => {
  const funding = { ...matching, matchRatio: 2, matchCap: 50 };
  assert.equal(campaignMatch(10, funding, 0).programmeGbp, 30);
  assert.equal(campaignMatch(10, funding, 45).programmeGbp, 15);
  assert.equal(campaignMatch(10, funding, 50).programmeGbp, 10);
  assert.equal(campaignMatch(3.01, { ...matching, matchRatio: 0.5 }, 0).matchedGbp, 1.51);
});
test("legacy funding and private revisions migrate to committed, preserving finances and explicit new types", () => {
  const legacy = { amount: 500, funderName: "Government" };
  const original = { _id: "camp", amountRaised: 123, matchFunding: legacy, matchFundingAnswer: "yes",
    editorDraft: { name: "Private revision", matchFunding: { ...legacy, amount: 750 } } };
  const migrated = migrateCampaignPartnerFunding(original);
  assert.deepEqual(migrated.partnerFunding, { ...legacy, type: "committed" });
  assert.deepEqual((migrated.editorDraft as any).partnerFunding, { ...legacy, amount: 750, type: "committed" });
  assert.equal(migrated.amountRaised, 123);
  assert.equal(migrated.partnerFundingAnswer, "yes");
  assert.equal("matchFunding" in migrated, false);
  assert.deepEqual(migrateCampaignPartnerFunding(migrated), migrated);
  assert.deepEqual(original.matchFunding, legacy, "Migration is pure until explicitly saved");
  assert.equal(partnerFundingFor(original)?.type, "committed");
  assert.equal(partnerFundingFor({ ...original, partnerFunding: matching })?.type, "matching");
});
