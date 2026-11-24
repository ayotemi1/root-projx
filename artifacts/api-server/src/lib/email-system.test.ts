import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";

const compiled = await build({
  stdin: { contents: `export * from "./src/lib/email/templates.ts";
    export * from "./src/lib/email/crypto.ts"; export * from "./src/lib/email/delivery.ts";
    export * from "./src/lib/email/brevo-transport.ts";
    export * from "./src/lib/email/preferences.ts";
    export {brevoSendEmail,brevoSendRecordedEmail} from "./src/lib/brevo.ts";
    export {emailConfiguration,saveEmailConfiguration} from "./src/lib/email/service.ts";
    export {nativeDonationEmailAmounts,londonDay} from "./src/lib/email/donation-events.ts";
    export {campaignFundingTotal} from "./src/lib/campaign-matching.ts";
    export {fsMutateEmailState,fsAcceptEmailInvitation,fsApproveOrganisationApplication} from "./src/lib/firebase-rest.ts";`,
    resolveDir: new URL("../../", import.meta.url).pathname },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external", loader: { ".html": "text" },
});
const mod = { exports: {} as any };
new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(
  createRequire(import.meta.url), mod, mod.exports);
const mail = mod.exports;
const fsFields = (input: Record<string, unknown>) => Object.fromEntries(Object.entries(input).map(([key, value]) =>
  [key, Array.isArray(value) ? { arrayValue: { values: value.map(v => ({ stringValue: v })) } }
    : typeof value === "boolean" ? { booleanValue: value } : { stringValue: value }]));
const sample = (id: string) => {
  const row = mail.emailManifest.find((m: any) => m.id === id);
  return Object.fromEntries(row.variables.filter((k: string) => !["logo_url", "site_url"].includes(k))
    .map((k: string) => [k, k.endsWith("_url") ? `https://rootprojx.com/sample/${k}` : k === "impact_line" ? "" : `sample ${k}`]));
};
const summary = () => ({
  firstName: "Sample", orgName: "Sample organisation", campaignName: "Sample campaign",
  currency: "gbp", raisedMinor: 1248500, goalMinor: 3000000,
  dashboardUrl: "https://rootprojx.com/dashboard", preferencesUrl: "https://rootprojx.com/settings",
  gifts: [{ publicDonorName: "Sample D.", giftMinor: 1000, orgReceivesMinor: 950 },
    { publicDonorName: null, giftMinor: 2000, orgReceivesMinor: 1900 }],
});

test("all sixteen original HTML files and manifest remain byte-for-byte unchanged", async () => {
  assert.equal(mail.emailManifest.length, 16);
  const timestamps = ["8662", "8663", "8665", "8666", "8667", "8668", "8669", "8669",
    "8670", "8670", "8671", "8671", "8672", "8673", "8674", "8674"];
  for (const [index, entry] of mail.emailManifest.entries()) {
    const original = await readFile(new URL(`../../../../attached_assets/${entry.id}_179547261${timestamps[index]}.html`, import.meta.url), "utf8");
    assert.equal(mail.emailSources[entry.id], original);
    const placeholders = [...new Set([...original.matchAll(/\{\{([a-z][a-z0-9_]+)\}\}/g)].map(m => m[1]))].sort();
    assert.deepEqual(placeholders, [...entry.variables].sort());
    const rendered = mail.renderEmail(entry.id, sample(entry.id));
    assert.equal(rendered.templateId, entry.id);
    assert.ok(rendered.textContent.trim());
    assert.ok(rendered.subject.trim());
    assert.ok(!/\{\{[a-z][a-z0-9_]+\}\}/.test(rendered.htmlContent));
    assert.ok(rendered.htmlContent.includes(`src="${mail.EMAIL_LOGO_URL}"`));
    assert.ok(!rendered.htmlContent.includes("data:image"));
    assert.ok(!rendered.textContent.includes("<table"));
    assert.ok(rendered.textContent.includes("https://rootprojx.com"));
  }
  const originalManifest = await readFile(new URL("../../../../attached_assets/index_1795472618675.json", import.meta.url), "utf8");
  const copy = await readFile(new URL("./email/templates/index.json", import.meta.url), "utf8");
  assert.equal(copy, originalManifest);
});

test("strict variables, HTTPS links, escaped HTML, literal user placeholders and plain-text URLs", () => {
  const id = "02-supporter-welcome";
  const data = sample(id);
  const result = mail.renderEmail(id, { ...data, first_name: `<img src=x onerror=attack> & "{{campaign_name}}"` });
  assert.ok(!result.htmlContent.includes("<img src=x"));
  assert.ok(result.htmlContent.includes("&lt;img src=x"));
  assert.ok(result.htmlContent.includes("{{campaign_name}}"));
  assert.ok(result.textContent.includes("<img src=x onerror=attack>"));
  assert.ok(result.textContent.includes("(https://rootprojx.com/sample/discover_url)"));
  for (const value of ["http://rootprojx.com/discover", "//rootprojx.com/discover", "javascript:alert(1)", "https://a:b@rootprojx.com"]) {
    assert.throws(() => mail.renderEmail(id, { ...data, discover_url: value }), /HTTPS/);
  }
  assert.throws(() => mail.renderEmail(id, { ...data, first_name: undefined }), /variable/);
  assert.throws(() => mail.renderEmail(id, { ...data, arbitrary: "unknown" }), /Unsupported/);
  assert.throws(() => mail.renderEmail(id, { ...data, logo_url: "https://elsewhere.test/a.png" }), /origin/);
});

test("daily summary preserves template 12 header/button and contains correct rows, net and campaign totals", () => {
  const result = mail.renderDailySummary(summary());
  assert.equal(result.subject, "Today's gifts to Sample campaign");
  assert.ok(result.textContent.includes("Sample D.\t£10.00"));
  assert.ok(result.textContent.includes("Anonymous\t£20.00"));
  assert.ok(result.textContent.includes("You'll receive\t£28.50"));
  assert.ok(result.textContent.includes("Campaign total\t£12,485.00 of £30,000.00"));
  assert.ok(result.htmlContent.includes("font-weight:700;\">You&#39;ll receive"));
  assert.ok(result.htmlContent.includes("View in your dashboard &rarr;"));
  assert.equal(result.htmlContent.match(/<tr><td align="center" style="background:#CA0813[^]*?<\/td><\/tr>/)?.[0],
    mail.emailSources["12-org-new-donation"].replaceAll("{{site_url}}", mail.EMAIL_SITE_URL)
      .replaceAll("{{logo_url}}", mail.EMAIL_LOGO_URL)
      .match(/<tr><td align="center" style="background:#CA0813[^]*?<\/td><\/tr>/)?.[0]);
  assert.ok(!result.htmlContent.includes("{{"));
  assert.equal(mail.renderDailySummary({ ...summary(), gifts: [] }), null);
  const one = mail.renderDailySummary({ ...summary(), currency: "usd", gifts: [summary().gifts[0]] });
  assert.ok(one.textContent.includes("You'll receive\tUS$9.50"));
  assert.ok(!one.textContent.includes("£"));
  assert.throws(() => mail.renderDailySummary({ ...summary(), gifts: [{ ...summary().gifts[0], giftMinor: -1 }] }));
  const escaped = mail.renderDailySummary({ ...summary(), gifts: [{ ...summary().gifts[0], publicDonorName: "<script>bad</script>" }] });
  assert.ok(escaped.htmlContent.includes("&lt;script&gt;"));
});

test("money uses actual supported currency and exactly two decimals; invalid amounts fail explicitly", () => {
  assert.equal(mail.emailMoney(750000, "usd"), "US$7,500.00");
  assert.equal(mail.emailMoney(1000, "gbp"), "£10.00");
  for (const n of [-1, NaN, Infinity, 0.01]) assert.throws(() => mail.emailMoney(n, "gbp"));
  assert.throws(() => mail.emailMoney(1, "jmd"));
});

function storeFixture() {
  const rows = new Map<string, any>();
  return {
    rows,
    async create(job: any) { if (rows.has(job.id)) return false; rows.set(job.id, structuredClone(job)); return true; },
    async get(id: string) { return structuredClone(rows.get(id) ?? null); },
    // Synchronous decision + apply models the production compare-and-swap.
    async mutate(id: string, decide: any) {
      const decision = decide(structuredClone(rows.get(id)));
      if (decision.patch) rows.set(id, { ...rows.get(id), ...structuredClone(decision.patch) });
      return decision.result;
    },
  };
}
const policy = async () => true;
const now = () => new Date("2026-11-23T12:00:00Z");
async function enqueue(store: any, id = "03-donation-receipt", eventKey = "sample-checkout") {
  return mail.enqueueEmail(store, { eventKey, to: "donor@example.test", message: mail.renderEmail(id, sample(id)) }, now());
}
async function withSecret(fn: () => Promise<void> | void) {
  const before = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "a-unit-test-secret-used-only-in-fixtures";
  try { await fn(); } finally {
    if (before === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = before;
  }
}

test("outbox encrypts private data; event/recipient creation and racing sends are unique", async () => withSecret(async () => {
  const store = storeFixture();
  const entries = await Promise.all(Array.from({ length: 12 }, () => enqueue(store)));
  assert.equal(entries.filter(x => x.created).length, 1);
  const id = entries[0].id;
  const row = store.rows.get(id);
  assert.ok(!JSON.stringify(row).includes("donor@example.test"));
  assert.ok(!JSON.stringify(row).includes("sample campaign_name"));
  assert.equal(mail.openEmail(row.encryptedPayload, id).to, "donor@example.test");
  assert.throws(() => mail.openEmail(row.encryptedPayload, "other-row"));
  assert.throws(() => mail.openEmail(row.encryptedPayload.slice(0, -6) + "broken", id));
  let sent = 0;
  const transport = { async send() { sent++; return { messageId: "provider-one" }; } };
  await Promise.all(Array.from({ length: 12 }, () => mail.deliverEmail(store, transport, id, policy, now())));
  assert.equal(sent, 1);
  assert.equal(store.rows.get(id).state, "accepted");
  assert.equal(store.rows.get(id).providerMessageId, "provider-one");
  assert.equal((await enqueue(store, "04-donation-receipt-guest")).created, false);
  const oldSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "rotated-unit-test-encryption-secret";
  assert.equal((await enqueue(store)).created, false, "rotating encryption must not create another receipt");
  process.env.SESSION_SECRET = oldSecret;
  await mail.deliverEmail(store, transport, id, policy, new Date(now().getTime() + 86_400_000));
  assert.equal(sent, 1);
}));

test("essential receipts ignore opt-outs; optional emails suppress, outages leave them queued and expired tokens never send", async () => withSecret(async () => {
  const store = storeFixture(); let sent = 0;
  const transport = { async send() { sent++; return { messageId: "provider" }; } };
  const receipt = await enqueue(store);
  assert.equal(await mail.deliverEmail(store, transport, receipt.id, async () => false, now()), "accepted");
  const optional = await enqueue(store, "02-supporter-welcome");
  assert.equal(await mail.deliverEmail(store, transport, optional.id, async () => false, now()), "suppressed");
  const outage = await enqueue(store, "05-supporter-campaign-goal-reached");
  await assert.rejects(mail.deliverEmail(store, transport, outage.id, async () => { throw new Error("outage"); }, now()));
  assert.equal(store.rows.get(outage.id).state, "queued");
  const reset = await mail.enqueueEmail(store, {
    eventKey: "sample-reset", to: "donor@example.test",
    message: mail.renderEmail("06-password-reset", sample("06-password-reset")),
    expiresAt: new Date(now().getTime() + 3_600_000),
  }, now());
  assert.equal(await mail.deliverEmail(store, transport, reset.id, policy, new Date(now().getTime() + 3_600_001)), "expired");
  assert.equal(sent, 1);
}));

test("ambiguous provider outcomes and interrupted sending never automatically retry; explicit rate limits can retry", async () => withSecret(async () => {
  for (const error of [new Error("network interruption"), new mail.EmailTransportError("uncertain", 503)]) {
    const store = storeFixture(); const { id } = await enqueue(store);
    let count = 0;
    const transport = { async send() { count++; throw error; } };
    assert.equal(await mail.deliverEmail(store, transport, id, policy, now()), "uncertain");
    await mail.deliverEmail(store, transport, id, policy, new Date(now().getTime() + 99_999_999));
    assert.equal(count, 1);
  }
  const store = storeFixture(); const { id } = await enqueue(store);
  assert.equal(await mail.deliverEmail(store, {
    async send() { throw new mail.EmailTransportError("retryable", 429); },
  }, id, policy, now()), "retryable");
  let count = 0; const transport = { async send() { count++; return { messageId: "rate-limit-recovered" }; } };
  assert.equal(await mail.deliverEmail(store, transport, id, policy, now()), "retryable");
  assert.equal(await mail.deliverEmail(store, transport, id, policy, new Date(now().getTime() + 900_001)), "accepted");
  assert.equal(count, 1);
  const stuck = await enqueue(store, "03-donation-receipt", "another-event");
  store.rows.get(stuck.id).state = "sending";
  assert.equal(await mail.deliverEmail(store, transport, stuck.id, policy, new Date(now().getTime() + 99_999_999)), "sending");
  assert.equal(count, 1);
}));

test("strict Brevo transport uses requested sender/reply-to and both bodies, preserving only provider acceptance", async () => {
  const beforeFetch = globalThis.fetch; const beforeKey = process.env.BREVO_API_KEY;
  process.env.BREVO_API_KEY = "fixture-never-a-real-key";
  try {
    let body: any;
    globalThis.fetch = async (_url, options) => { body = JSON.parse(String(options?.body));
      return new Response(JSON.stringify({ messageId: "accepted-fixture" }), { status: 201 }); };
    const message = mail.renderEmail("06-password-reset", sample("06-password-reset"));
    assert.deepEqual(await mail.brevoEmailTransport.send({ to: "donor@example.test", message }), { messageId: "accepted-fixture" });
    assert.deepEqual(body.sender, { name: "Root ProjX", email: "info@rootprojx.com" });
    assert.equal(body.replyTo.email, "info@rootprojx.com");
    assert.equal(body.htmlContent, message.htmlContent);
    assert.equal(body.textContent, message.textContent);
    for (const [status, disposition] of [[401, "rejected"], [429, "retryable"], [500, "uncertain"]]) {
      globalThis.fetch = async () => new Response("must-not-leak-recipient-or-provider-error", { status: Number(status) });
      await assert.rejects(mail.brevoEmailTransport.send({ to: "donor@example.test", message }), (error: any) =>
        error.disposition === disposition && !error.message.includes("must-not-leak"));
    }
    delete process.env.BREVO_API_KEY;
    await assert.rejects(mail.brevoEmailTransport.send({ to: "donor@example.test", message }));
  } finally {
    globalThis.fetch = beforeFetch;
    if (beforeKey === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = beforeKey;
  }
});

test("all mail ignores legacy sender overrides and keeps admin alerts on the monitored inbox", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.BREVO_API_KEY;
  const originalSender = process.env.BREVO_SENDER_EMAIL;
  process.env.BREVO_API_KEY = "fixture-never-a-real-key";
  process.env.BREVO_SENDER_EMAIL = "unused@example.test";
  try {
    const bodies: any[] = [];
    globalThis.fetch = async (_url, options) => {
      bodies.push(JSON.parse(String(options?.body)));
      return new Response(JSON.stringify({ messageId: "accepted-fixture" }), { status: 201 });
    };
    await mail.brevoSendEmail({
      to: [{ email: "recipient@example.test" }], subject: "Fixture", htmlContent: "<p>Fixture</p>",
      senderName: "Unused", senderEmail: "unused@example.test", replyTo: { email: "unused@example.test" },
    });
    await mail.brevoSendRecordedEmail({
      to: [{ email: "recipient@example.test" }], subject: "Fixture", htmlContent: "<p>Fixture</p>", textContent: "Fixture",
      sender: { email: "unused@example.test" }, replyTo: { email: "unused@example.test" },
    });
    for (const body of bodies) {
      assert.deepEqual(body.sender, { name: "Root ProjX", email: "info@rootprojx.com" });
      assert.deepEqual(body.replyTo, body.sender);
    }
    assert.deepEqual(await mail.emailConfiguration(), { adminRecipient: "info@rootprojx.com" });
    await assert.rejects(mail.saveEmailConfiguration("unused@example.test"), (error: any) => error.status === 400);
    assert.equal(bodies.length, 2, "configuration checks must not send mail or access private records");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = originalKey;
    if (originalSender === undefined) delete process.env.BREVO_SENDER_EMAIL; else process.env.BREVO_SENDER_EMAIL = originalSender;
  }
});

test("password resets use Firebase Auth delivery without an app-managed credential", async () => {
  const route = await readFile(new URL("../routes/auth.ts", import.meta.url), "utf8");
  assert.match(route, /await firebaseSendPasswordResetEmail\(email\)/);
  assert.doesNotMatch(route, /customResetLinkReady|requestBrandedPasswordReset|FIREBASE_AUTH_SERVICE_ACCOUNT_JSON/);
});

test("template 06 is suppressed even for previously queued work and explicit retry", async () => withSecret(async () => {
  const store = storeFixture();
  const entry = await enqueue(store, "06-password-reset", "old-reset");
  const transport = { async send() { assert.fail("Firebase Auth, not the app outbox, must send resets"); return { messageId: "never" }; } };
  assert.equal(await mail.deliverEmail(store, transport, entry.id, policy, now()), "suppressed");
  assert.equal(store.rows.get(entry.id).attempts, 0);
  store.rows.set(entry.id, { ...store.rows.get(entry.id), state: "retryable" });
  assert.equal(await mail.deliverEmail(store, transport, entry.id, policy, now()), "suppressed");
}));

test("Firestore email claims use version preconditions and reread after a racing claim", async () => {
  const beforeFetch = globalThis.fetch; let reads = 0; let commits = 0;
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith(":commit")) {
        commits++;
        const body = JSON.parse(String(options?.body));
        assert.deepEqual(body.writes[0].currentDocument, { updateTime: "first-version" });
        assert.deepEqual(body.writes[0].updateMask, { fieldPaths: ["state"] });
        assert.equal(body.writes[0].update.fields.state.stringValue, "sending");
        return new Response("conflict", { status: 409 });
      }
      reads++;
      return new Response(JSON.stringify({
        fields: { state: { stringValue: reads === 1 ? "queued" : "sending" } },
        updateTime: reads === 1 ? "first-version" : "other-worker-version",
      }), { status: 200 });
    };
    const won = await mail.fsMutateEmailState("email_outbox", "a".repeat(64), "fixture",
      (row: any) => row.state === "queued" ? { patch: { state: "sending" }, result: true } : { result: false });
    assert.equal(won, false);
    assert.equal(reads, 2);
    assert.equal(commits, 1);
    await assert.rejects(mail.fsMutateEmailState("donations", "a".repeat(64), "fixture", () => ({ result: true })));
    await assert.rejects(mail.fsMutateEmailState("email_outbox", "../users/owner", "fixture", () => ({ result: true })));
    globalThis.fetch = async () => new Response("private-provider-data", { status: 403 });
    await assert.rejects(mail.fsMutateEmailState("email_outbox", "a".repeat(64), "fixture", () => ({ result: true })),
      (error: any) => !error.message.includes("private-provider-data"));
  } finally { globalThis.fetch = beforeFetch; }
});

test("financial templates retain their exact design while omitting only inapplicable rows", () => {
  for (const id of ["03-donation-receipt", "04-donation-receipt-guest", "12-org-new-donation", "15-org-payout-sent"]) {
    assert.deepEqual(mail.renderFinancialEmail(id, sample(id)), mail.renderEmail(id, sample(id)));
  }
  const receipt = sample("03-donation-receipt");
  delete receipt.card_fee;
  delete receipt.card_last4;
  delete receipt.card_brand;
  const noCover = mail.renderFinancialEmail("03-donation-receipt", receipt, ["card_fee", "card_last4"]);
  assert.ok(!noCover.htmlContent.includes("Card fee (you chose to cover it)"));
  assert.ok(!noCover.htmlContent.includes("Paid by"));
  assert.ok(noCover.htmlContent.includes("Your gift"));
  const org = sample("12-org-new-donation");
  delete org.campaign_raised; delete org.campaign_goal;
  assert.ok(!mail.renderFinancialEmail("12-org-new-donation", org, ["campaign_raised"]).htmlContent.includes("Campaign total"));
  const payout = sample("15-org-payout-sent");
  for (const key of ["account_last4", "arrival_date", "period_start", "period_end"]) delete payout[key];
  const minimal = mail.renderFinancialEmail("15-org-payout-sent", payout, ["account_last4", "arrival_date", "period_start"]);
  assert.ok(!minimal.htmlContent.includes("Account ending"));
  assert.ok(!minimal.htmlContent.includes("Should arrive by"));
  assert.ok(!minimal.htmlContent.includes("Covers gifts from"));
  assert.equal(minimal.preheader, "");
  assert.throws(() => mail.renderFinancialEmail("15-org-payout-sent", payout, ["payout_amount"]));
});

test("daily summaries omit absent targets and safely display literal donor text", () => {
  const rendered = mail.renderDailySummary({ ...summary(), hasCampaignTarget: false,
    gifts: [{ publicDonorName: "<b>{{gift_rows}}</b>", giftMinor: 1000, orgReceivesMinor: 915 }] });
  assert.ok(!rendered.htmlContent.includes("Campaign total"));
  assert.ok(rendered.htmlContent.includes("£9.15"));
  assert.ok(rendered.htmlContent.includes("&lt;b&gt;{{gift_rows}}&lt;/b&gt;"));
  assert.ok(!rendered.htmlContent.includes("<b>{{gift_rows}}</b>"));
});

test("email preferences are email-scoped, signed, expiring and not account-access tokens", () => {
  const old = process.env.SESSION_SECRET; process.env.SESSION_SECRET = "unit-preference-key-not-a-live-secret";
  try {
    const now = Date.now();
    const link = new URL(mail.emailPreferencesLink("Example@Example.org", true, now));
    const key = new URLSearchParams(link.hash.slice(1)).get("key")!;
    assert.ok(!link.href.includes("Example"));
    assert.deepEqual(mail.parsePreferenceKey(key, now), { id: mail.preferenceIdentity("example@example.org"), isOrganisation: true });
    assert.throws(() => mail.parsePreferenceKey(`${key.slice(0, -2)}AA`, now));
    assert.throws(() => mail.parsePreferenceKey(key, now + 181 * 24 * 3600 * 1000));
    assert.throws(() => mail.parsePreferenceKey("a".repeat(43), now));
  } finally { if (old === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old; }
});

test("native receipt amounts never substitute GBP settlement for a USD campaign gift", () => {
  const accounting = { intendedGbp: 10, toOrgGbp: 9.5, chargedGbp: 10.35, feeCoverGbp: 0.35, feeCovered: true };
  const result = mail.nativeDonationEmailAmounts({ currency: "usd", amountGbp: 7.5, chargedGbp: 7.8, receiptAccounting: accounting });
  assert.deepEqual({ currency: result.currency, gift: result.gift, receives: result.receives, charged: result.charged, cover: result.cover },
    { currency: "usd", gift: 1000, receives: 950, charged: 1035, cover: 35 });
  assert.throws(() => mail.nativeDonationEmailAmounts({ currency: "usd", amountGbp: 7.5 }));
  assert.throws(() => mail.nativeDonationEmailAmounts({ currency: "gbp", receiptAccounting: { ...accounting, chargedGbp: -1 } }));
  assert.throws(() => mail.nativeDonationEmailAmounts({ currency: "gbp", receiptAccounting: { ...accounting, toOrgGbp: 1.234 } }));
  assert.equal(mail.londonDay("2026-07-01T23:05:00Z"), "2026-07-02");
  assert.equal(mail.londonDay("2026-11-23T23:05:00Z"), "2026-11-23");
});

test("application approval commits role, profile and decision atomically and rejects a concurrent decline", async () => {
  const beforeFetch = globalThis.fetch;
  let status = "pending", commits = 0;
  globalThis.fetch = async (url: any, init?: RequestInit) => {
    if (String(url).endsWith(":commit")) {
      commits++;
      const writes = JSON.parse(String(init!.body)).writes;
      assert.equal(writes.length, 3);
      assert.ok(writes.every((w: any) => w.currentDocument));
      assert.ok(writes.some((w: any) => w.update?.name.endsWith("/users/owner") && w.update.fields.approvalStatus.stringValue === "approved"));
      assert.ok(writes.some((w: any) => w.update?.name.endsWith("/organisations/owner") && w.currentDocument.exists === false));
      status = "declined";
      return new Response("FAILED_PRECONDITION", { status: 400 });
    }
    const path = String(url).split("/documents/")[1];
    if (path === "organisations/owner") return new Response("", { status: 404 });
    return Response.json({ fields: fsFields(path === "users/owner" ? { accountType: "organisation" } : { uid: "owner", status }), updateTime: status });
  };
  try {
    await assert.rejects(mail.fsApproveOrganisationApplication("app", "owner", { name: "Sample organisation" },
      { accountType: "organisation", approvalStatus: "approved" }, { status: "approved" }, "fixture"));
    assert.equal(commits, 1);
  } finally { globalThis.fetch = beforeFetch; }
});

test("a consumed team invitation cannot restore a grant that the owner removed", async () => {
  const beforeFetch = globalThis.fetch;
  let commits = 0;
  globalThis.fetch = async (_url: any, init?: RequestInit) => {
    if (init?.method === "POST") { commits++; throw new Error("A consumed invitation must not write."); }
    return Response.json({ fields: fsFields({ recipientDigest: "b".repeat(64), status: "accepted",
      acceptedBy: "invitee", orgId: "owner", expiresAt: new Date(Date.now() + 86400000).toISOString() }), updateTime: "v1" });
  };
  try {
    await mail.fsAcceptEmailInvitation("a".repeat(64), "invitee", "b".repeat(64), "fixture");
    assert.equal(commits, 0);
  } finally { globalThis.fetch = beforeFetch; }
});
