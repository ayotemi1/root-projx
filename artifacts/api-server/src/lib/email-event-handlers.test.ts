import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
process.env.SESSION_SECRET = "isolated-email-handler-fixture";
process.env.TEAM_EMAIL = "team@example.test";

const fixture = {
  docs: new Map<string, any>(), jobs: new Map<string, any>(), frequency: "every_gift",
  failOrg: false,
};
(globalThis as any).__emailHandlerFixture = fixture;
const modules: Record<string, string> = {
  "firebase-rest": `const s=globalThis.__emailHandlerFixture;
    export const getServerToken=async()=>"fixture";
    export const fsGet=async(c,id)=>structuredClone(s.docs.get(c+"/"+id)??null);
    export const fsPatch=async(c,id,p)=>s.docs.set(c+"/"+id,{...s.docs.get(c+"/"+id),...p});
    export const fsQuery=async()=>[];
    export const fsCreateIfAbsent=async(c,id,data)=>{const key=c+"/"+id;if(s.docs.has(key))return false;s.docs.set(key,structuredClone(data));return true;};`,
  "stripeClient": `export const getUncachableStripeClient=async()=>({paymentIntents:{retrieve:async()=>({
    status:"succeeded",latest_charge:{status:"succeeded",paid:true,payment_method_details:{type:"card",card:{brand:"visa",last4:"4417"}}}
  })}});`,
  "preferences": `export const preferenceIdentity=()=>"fixture";
    export const emailPreferencesLink=()=>"https://rootprojx.com/email-preferences";
    export const readMailPreferences=async()=>({orgGifts:true,giftFrequency:globalThis.__emailHandlerFixture.frequency});`,
  "service": `export const firstName=v=>String(v||"there").split(" ")[0];
    export const emailDate=()=>"23 November 2026";
    export const submitRenderedEmail=async(event,to,message)=>{
      const s=globalThis.__emailHandlerFixture;if(s.failOrg&&to==="owner@example.test")throw Error("Fixture recipient unavailable");
      const key=event+":"+message.templateId+":"+to;
      if(!s.jobs.has(key))s.jobs.set(key,{to,message,event});
      return {state:"accepted",created:true};
    };`,
  "obligations": `export const recordAndFulfilEmail=async()=>{};`,
  "fees": `export const PLATFORM_FEE_PERCENT=5;`,
};
const compiled = await build({
  stdin: { contents: `export {deliverDonationEmails} from "./src/lib/email/donation-events.ts"; export {openEmail} from "./src/lib/email/crypto.ts"; export {campaignFundingTotal} from "./src/lib/campaign-matching.ts";`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  loader: { ".html": "text" },
  plugins: [{ name: "isolated-email-handler", setup(b) {
    b.onResolve({ filter: /\/(firebase-rest|stripeClient|preferences|service|obligations|fees)\.(?:js|ts)$/ },
      a => ({ path: a.path.split("/").at(-1)!.replace(/\.(js|ts)$/, ""), namespace: "email-handler-fixture" }));
    b.onLoad({ filter: /.*/, namespace: "email-handler-fixture" }, a => ({ contents: modules[a.path]!, loader: "js" }));
  } }],
});
const mod = { exports: {} as any };
new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(require, mod, mod.exports);
const mail = mod.exports;
function reset(covered = true, currency = "usd") {
  fixture.docs.clear(); fixture.jobs.clear(); fixture.frequency = "every_gift"; fixture.failOrg = false;
  fixture.docs.set("donations/gift", {
    status: "succeeded", type: "one_time", userId: "donor", orgId: "org", campaignId: "camp",
    currency, stripeRef: "pi_fixture", createdAt: "2026-11-23T12:00:00Z",
    amountGbp: 7.5, publicDonorName: null,
    receiptAccounting: { currency, intendedGbp: 10, toOrgGbp: covered ? 9.5 : 9.15,
      chargedGbp: covered ? 10.35 : 10, feeCoverGbp: covered ? 0.35 : 0,
      stripeFeeGbp: 0.35, estimatedStripeFeeGbp: 0.35, platformFeeGbp: 0.5, feeCovered: covered },
  });
  fixture.docs.set("organisations/org", { _id: "org", name: "Sample organisation", contact: { email: "public@example.test" },
    campaigns: [{ _id: "camp", name: "Sample campaign", currency, goal: 30000, amountRaised: 12485 }] });
  fixture.docs.set("users/org", { name: "Owner", email: "owner@example.test" });
  fixture.docs.set("users/donor", { name: "Private Name", email: "donor@example.test" });
}

test("donation fan-out uses native amounts, private owner email, anonymous names and event-safe replay", async () => {
  reset(); await mail.deliverDonationEmails("gift"); await mail.deliverDonationEmails("gift");
  assert.equal(fixture.jobs.size, 3);
  const jobs = [...fixture.jobs.values()];
  assert.deepEqual(jobs.map(j => j.to).sort(), ["donor@example.test", "info@rootprojx.com", "owner@example.test"]);
  const receipt = jobs.find(j => j.to === "donor@example.test").message.htmlContent;
  assert.match(receipt, /US\$10\.35/); assert.match(receipt, /US\$9\.50/);
  assert.doesNotMatch(receipt, /£7\.50/);
  for (const j of jobs.filter(j => j.to !== "donor@example.test")) {
    assert.match(j.message.htmlContent, /Anonymous/);
    assert.doesNotMatch(j.message.htmlContent, /Private Name|donor@example\.test/);
  }
});

test("an uncovered card fee is absent from the receipt without changing net proceeds", async () => {
  reset(false, "gbp"); await mail.deliverDonationEmails("gift");
  const receipt = [...fixture.jobs.values()].find(j => j.to === "donor@example.test").message.htmlContent;
  assert.doesNotMatch(receipt, /Card fee \(you chose to cover it\)/);
  assert.match(receipt, /£9\.15/);
});

test("a missing private organisation address never falls back to the public contact", async () => {
  reset(); fixture.docs.delete("users/org");
  await assert.rejects(mail.deliverDonationEmails("gift"));
  assert.deepEqual([...fixture.jobs.values()].map(j => j.to).sort(), ["donor@example.test", "info@rootprojx.com"]);
});

test("one organisation delivery failure cannot block the receipt or operational alert", async () => {
  reset(); fixture.failOrg = true;
  await assert.rejects(mail.deliverDonationEmails("gift")); assert.equal(fixture.jobs.size, 2);
  fixture.failOrg = false; await mail.deliverDonationEmails("gift"); assert.equal(fixture.jobs.size, 3);
});

test("daily mode journals each gift once while retaining receipts and operational alerts", async () => {
  reset(); fixture.frequency = "daily_summary";
  await mail.deliverDonationEmails("gift"); await mail.deliverDonationEmails("gift");
  assert.equal(fixture.jobs.size, 2);
  const rows = [...fixture.docs.entries()].filter(([path, value]) => path.startsWith("email_events/") && value.kind === "daily-gift");
  assert.equal(rows.length, 1);
  const [path, row] = rows[0]!;
  const payload = mail.openEmail(row.encryptedPayload, path.split("/")[1]);
  assert.equal(payload.orgReceivesMinor, 950); assert.equal(payload.giftMinor, 1000);
  assert.equal(payload.publicDonorName, null);
});

test("public progress counts commitments and only actually allocated matching funds", () => {
  assert.equal(mail.campaignFundingTotal({ amountRaised: 6, partnerFunding: { type: "committed", amount: 4 } }), 10);
  assert.equal(mail.campaignFundingTotal({ amountRaised: 6, partnerFunding: { type: "matching", amount: 100 }, partnerFundingMatchedGbp: 4 }), 10);
  assert.equal(mail.campaignFundingTotal({ amountRaised: 6, partnerFunding: { type: "matching", amount: 100 }, partnerFundingMatchedGbp: 0 }), 6);
  assert.throws(() => mail.campaignFundingTotal({ amountRaised: "unknown" }));
});
