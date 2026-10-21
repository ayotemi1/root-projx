import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

// These tests compile the real routers but replace EVERY external-service
// boundary. They never read Stripe keys, call Stripe/Brevo, or access Firestore.
async function isolatedRouters() {
  const mocks: Record<string, string> = {
    state: `
      export const state = {
        documents: new Map(), writes: [], errors: [], emails: [], checkout: null, event: null,
        failLedgerOnce: false
      };
      state.documents.set("organisations/test-org", {
        _id: "test-org", name: "Test Organisation", stripe_account_id: "acct_synthetic",
        totalRaised: 10,
        campaigns: [{_id: "test-campaign", title: "Test Campaign", amountRaised: 10}]
      });
      state.documents.set("users/test-user", {name:"Test Donor", email:"donor@example.test"});
    `,
    "firebase-rest.js": `
      import {state} from "phase0:state";
      export const getServerToken = async () => "synthetic-token";
      export const fsGet = async (collection, id) =>
        structuredClone(state.documents.get(collection + "/" + id) ?? null);
      export const fsQuery = async (collection, filters) => {
        return [...state.documents.entries()]
          .filter(([key, doc]) => key.startsWith(collection + "/") &&
            filters.every(f => {
              if (f.op !== "EQUAL") throw Error("Unsupported mock query");
              return doc[f.field] === f.value;
            }))
          .map(([key, doc]) => ({...structuredClone(doc), _id:key.split("/")[1]}));
      };
      export const fsCreate = async (collection, data) => {
        const id = "synthetic-" + state.writes.length;
        state.writes.push({collection, id, data:structuredClone(data)});
        state.documents.set(collection + "/" + id, structuredClone(data));
        return id;
      };
      export const fsCreateIfAbsent = async (collection,id,data) => {
        if (state.failLedgerOnce) { state.failLedgerOnce=false; throw Error("Synthetic ledger outage"); }
        const key=collection+"/"+id;
        if(state.documents.has(key)) return false;
        state.documents.set(key,structuredClone(data));
        state.writes.push({collection,id,data:structuredClone(data)});
        return true;
      };
      export const fsMutateCampaigns = async (id,token,mutate) => {
        const key="organisations/"+id;
        const current=structuredClone(state.documents.get(key));
        const {campaigns,result}=mutate(current);
        state.documents.set(key,{...current,campaigns});
        return result;
      };
      export const fsPatch = async (collection, id, patch) => {
        const key = collection + "/" + id;
        state.documents.set(key, {...state.documents.get(key), ...structuredClone(patch)});
      };
      export const fsIncrement = async (collection, id, increments) => {
        const key = collection + "/" + id;
        const doc = state.documents.get(key);
        if (!doc) throw Error("Missing mock document");
        for (const [field, increment] of Object.entries(increments)) {
          doc[field] = (doc[field] ?? 0) + increment;
        }
      };
    `,
    "auth.js": `
      export const requireAuth = (_req, _res, next) => next();
      export const optionalAuth = requireAuth;
    `,
    "stripeClient.js": `
      import {state} from "phase0:state";
      export const getStripePublishableKey = async () => { throw Error("Unexpected key fetch"); };
      export const getUncachableStripeClient = async () => ({
        webhooks: {
          constructEvent: (body, sig, secret) => {
            if (sig !== "synthetic-signature" || secret !== "synthetic-secret") {
              throw Error("Unexpected test webhook input");
            }
            return JSON.parse(body.toString());
          }
        },
        checkout: {sessions: {
          create: async (params) => {
            state.checkout = structuredClone(params);
            return {id:"cs_synthetic",url:"https://example.test/checkout"};
          },
          retrieve: async () => ({
            id:"cs_synthetic",payment_status:"paid",
            amount_total:state.event.data.object.amount,
            payment_intent:structuredClone(state.event.data.object),
            customer_email:"donor@example.test"
          })
        }}
      });
    `,
    "brevo.js": `
      import {state} from "phase0:state";
      export const brevoSendEmail = async (email) => {state.emails.push(email);};
      export {donationConfirmationHtml, shopOrderConfirmationHtml}
        from ${JSON.stringify(new URL("./brevo.ts", import.meta.url).pathname)};
    `,
  };
  const result = await build({
    stdin: {
      contents: `
        export {default as donations} from "./routes/donations.ts";
        export {default as webhooks} from "./routes/webhooks.ts";
        export {state} from "phase0:state";
      `,
      resolveDir: new URL("../", import.meta.url).pathname,
      loader: "ts",
    },
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    // Do not read configured secrets; exercise the default 5% fee in isolation.
    define: {
      "process.env.STRIPE_WEBHOOK_SECRET": JSON.stringify("synthetic-secret"),
      "process.env.STRIPE_PLATFORM_FEE_PERCENT": "undefined",
    },
    plugins: [{
      name: "phase0-isolated-services",
      setup(builder) {
        builder.onResolve({ filter: /^phase0:state$|\/(firebase-rest|stripeClient|auth|brevo)\.js$/ }, (args) => ({
          path: args.path === "phase0:state" ? "state" : args.path.split("/").pop()!,
          namespace: "phase0-mocks",
        }));
        builder.onLoad({ filter: /.*/, namespace: "phase0-mocks" }, (args) => ({
          contents: mocks[args.path], loader: "js",
          resolveDir: new URL("./", import.meta.url).pathname,
        }));
      },
    }],
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(
    createRequire(import.meta.url), module, module.exports,
  );
  return module.exports;
}

async function invoke(router: any, path: string, req: Record<string, unknown>, expectedStatus = 200) {
  const route = router.stack.find((layer: any) => layer.route?.path === path)?.route;
  assert.ok(route, `Missing real route ${path}`);
  let status = 200;
  let body: any;
  const res = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; },
    setHeader() {},
  };
  await route.stack.at(-1).handle(req, res);
  assert.equal(status, expectedStatus, JSON.stringify(body));
  return body;
}

for (const path of ["/donations/checkout", "/donations/anonymous-checkout"]) {
  test(`${path} routes Checkout by resolved payout method without live services`, async (t) => {
    const cases: Array<{name: string; setup: Record<string, unknown>; method: string}> = [
      {name: "Stripe Connect", setup: {payoutMethod: "stripe", stripe_account_id: "acct_selected"}, method: "stripe_connect"},
      // Stale Stripe credentials must not override a selected alternative.
      {name: "Wise", setup: {payoutMethod: "wise", wise_email: "payee@example.test", stripe_account_id: "acct_old"}, method: "wise"},
      {name: "approved bank transfer", setup: {payoutMethod: "bank_transfer", payoutManualRequested: true, payoutManualApproved: true, stripe_account_id: "acct_old"}, method: "manual"},
      {name: "unset", setup: {}, method: "none"},
      {name: "pending bank transfer", setup: {payoutMethod: "bank_transfer", payoutManualRequested: true, payoutManualApproved: false, stripe_account_id: "acct_old"}, method: "none"},
      {name: "legacy pending bank transfer", setup: {payoutManualRequested: true}, method: "none"},
      {name: "Stripe selection without account", setup: {payoutMethod: "stripe"}, method: "none"},
    ];
    for (const scenario of cases) {
      for (const feeCovered of [true, false]) {
        await t.test(`${scenario.name}, fee cover ${feeCovered ? "ON" : "OFF"}`, async () => {
          const {donations, state} = await isolatedRouters();
          state.documents.set("organisations/test-org", {
            name: "Test Organisation",
            campaigns: [{_id: "test-campaign", amountRaised: 10}],
            ...scenario.setup,
          });
          const feeAmountPence = feeCovered ? 25 : 0;
          const body = await invoke(donations, path, {
            body: {
              orgId: "test-org", campaignId: "test-campaign",
              guestEmail: "guest@example.test", amountPence: 300 + feeAmountPence,
              originalAmountPence: 300, feeAmountPence, feeCovered, wallOptIn: true,
            },
            user: {userId: "test-user"}, headers: {},
            log: {error() { assert.fail("Unexpected Checkout error"); }},
          }, scenario.method === "none" ? 400 : 200);
          if (scenario.method === "none") {
            assert.deepEqual(body, {error: "This organisation isn't set up to receive donations yet."});
            assert.equal(state.checkout, null, "Rejected organisations must not create a session");
            return;
          }
          assert.equal(body.sessionId, "cs_synthetic");
          const session = state.checkout;
          const intent = session.payment_intent_data;
          if (scenario.method === "stripe_connect") {
            assert.deepEqual(intent.transfer_data, {destination: "acct_selected"});
            assert.equal(intent.application_fee_amount, 15);
          } else {
            assert.equal(Object.hasOwn(intent, "transfer_data"), false);
            assert.equal(Object.hasOwn(intent, "application_fee_amount"), false);
          }
          assert.equal(intent.metadata.payoutMethod, scenario.method);
          assert.equal(intent.metadata.orgId, "test-org");
          assert.equal(intent.metadata.orgName, "Test Organisation");
          assert.equal(intent.metadata.campaignId, "test-campaign");
          assert.equal(intent.metadata.originalAmountPence, "300");
          assert.equal(intent.metadata.feePence, "15");
          assert.equal(intent.metadata.feeCovered, String(feeCovered));
          assert.equal(intent.metadata.feeAmountPence, String(feeAmountPence));
          assert.equal(intent.metadata.amountPence, String(300 + feeAmountPence));
          assert.equal(session.line_items[0].price_data.unit_amount, 300 + feeAmountPence);
          assert.equal(session.line_items[0].price_data.currency, "gbp");
          if (path === "/donations/checkout") {
            assert.equal(intent.metadata.wallOptIn, "true");
            assert.equal(intent.metadata.userId, "test-user");
            assert.equal(session.customer_email, "donor@example.test");
            assert.ok(session.cancel_url.endsWith("/donate/test-org?campaign=test-campaign"));
          } else {
            assert.equal(intent.metadata.userId, "anonymous");
            assert.equal(intent.metadata.type, "anonymous_one_time");
          }
        });
      }
    }
  });
}

for (const method of ["wise", "manual", "stripe_connect"]) {
  test(`webhook payout ledger: ${method}, replay and canonical amount`, async () => {
    const {webhooks, state} = await isolatedRouters();
    const event = {id:"evt_ledger", type:"payment_intent.succeeded", created:1791979200, data:{object:{
      id:"pi_ledger", amount:325, currency:"gbp", metadata:{
        orgId:"test-org", orgName:"Test Organisation", originalAmountPence:"300",
        feeCovered:"true", payoutMethod:method,
      },
    }}};
    const req = {body:Buffer.from(JSON.stringify(event)),headers:{"stripe-signature":"synthetic-signature"},
      log:{info(){},error(){}}};
    await invoke(webhooks,"/stripe",req);
    await invoke(webhooks,"/stripe",req);
    const rows = state.writes.filter((w:any)=>w.collection==="payouts");
    assert.equal(rows.length, method === "stripe_connect" ? 0 : 1);
    if(rows.length) {
      assert.equal(rows[0].data.amountGbp,2.85);
      assert.equal(rows[0].data.status,"queued");
      assert.equal(rows[0].data.method,method);
      assert.equal(rows[0].data.stripeRef,"pi_ledger");
      // A replay must never reset a settled row to queued.
      state.documents.get("payouts/"+rows[0].id).status="sent";
      await invoke(webhooks,"/stripe",req);
      assert.equal(state.documents.get("payouts/"+rows[0].id).status,"sent");
    }
    assert.equal(state.writes.filter((w:any)=>w.collection==="donations").length,1);
  });
}

test("webhook retry repairs a failed ledger write after donation recording", async () => {
  const {webhooks,state}=await isolatedRouters();
  state.failLedgerOnce=true;
  const event={type:"payment_intent.succeeded",data:{object:{id:"pi_repair",amount:300,currency:"gbp",
    metadata:{orgId:"test-org",originalAmountPence:"300",payoutMethod:"manual"}}}};
  const req={body:Buffer.from(JSON.stringify(event)),headers:{"stripe-signature":"synthetic-signature"},log:{info(){},error(){}}};
  await invoke(webhooks,"/stripe",req,500);
  await invoke(webhooks,"/stripe",req);
  assert.equal(state.writes.filter((w:any)=>w.collection==="payouts").length,1);
  assert.equal(state.writes.filter((w:any)=>w.collection==="payouts")[0].data.amountGbp,2.60);
  assert.equal(state.writes.filter((w:any)=>w.collection==="donations").length,1);
  assert.equal(state.documents.get("organisations/test-org").totalRaised,13);
});

for (const feeCovered of [true, false]) {
  test(`Phase 0 synthetic Checkout webhook: £3, campaign set, fee coverage ${feeCovered ? "ON" : "OFF"}`, async (t) => {
    const { donations, webhooks, state } = await isolatedRouters();
    const log = {
      info() {}, warn() {},
      error(obj: unknown, message: string) { state.errors.push({ obj, message }); },
    };
    const originalAmountPence = 300;
    const feeAmountPence = feeCovered ? 25 : 0; // web estimate: 1.5% + £0.20
    const grossPence = originalAmountPence + feeAmountPence;

    await invoke(donations, "/donations/checkout", {
      body: {
        orgId: "test-org", campaignId: "test-campaign",
        guestEmail: "donor@example.test", amountPence: grossPence,
        originalAmountPence, feeAmountPence, feeCovered,
      },
      user: {userId:"test-user"}, headers: {}, log,
    });
    const intentData = state.checkout.payment_intent_data;
    assert.equal(intentData.application_fee_amount, 15, "Platform fee must be 5% of £3");
    assert.equal(intentData.metadata.feePence, "15");
    assert.equal(intentData.metadata.originalAmountPence, "300");
    assert.equal(intentData.metadata.campaignId, "test-campaign");
    assert.equal(state.checkout.line_items[0].price_data.unit_amount, grossPence);

    const paymentIntent = {
      id: `pi_synthetic_${feeCovered ? "covered" : "uncovered"}`,
      object: "payment_intent", amount: grossPence, amount_received: grossPence,
      currency: "gbp", status: "succeeded",
      application_fee_amount: intentData.application_fee_amount,
      metadata: intentData.metadata,
    };
    const event = {
      id: "evt_synthetic", object: "event", type: "payment_intent.succeeded",
      created: 1791979200, livemode: false, data: { object: paymentIntent },
    };
    state.event = event;
    const webhookRequest = {
      body: Buffer.from(JSON.stringify(event)),
      headers: { "stripe-signature": "synthetic-signature" }, log,
    };
    // Run through the real webhook dispatcher into private handlePaymentSuccess,
    // then replay delivery and visit confirm to check the single-writer boundary.
    await invoke(webhooks, "/stripe", webhookRequest);
    await invoke(webhooks, "/stripe", webhookRequest);
    const confirmation = await invoke(donations, "/donations/confirm", {
      query: { session_id: "cs_synthetic" }, log,
    });
    assert.equal(confirmation.recorded, true);
    const writes = state.writes.filter((write: any) => write.collection === "donations");
    assert.equal(writes.length, 1, "Retry/confirm must not write another donation");
    const donation = writes[0].data;
    assert.equal(donation.stripeRef, paymentIntent.id);
    assert.equal(donation.campaignId, "test-campaign");
    const toOrgGbp = feeCovered ? 2.85 : 2.60;
    assert.equal(donation.intendedGbp, 3);
    assert.equal(donation.platformFeeGbp, 0.15);
    assert.equal(donation.chargedGbp, grossPence / 100);
    assert.equal(donation.toOrgGbp, toOrgGbp);
    assert.equal(donation.netAmountGbp, toOrgGbp);
    assert.equal(donation.grossAmountGbp, grossPence / 100);
    assert.equal(donation.feeCoverGbp, feeAmountPence / 100);
    assert.equal(donation.feeCovered, feeCovered);
    assert.equal(donation.feeAmountGbp, feeAmountPence / 100);
    assert.equal(donation.amountGbp, 3, "Legacy amount now means intended donation");
    const org = state.documents.get("organisations/test-org");
    assert.equal(org.campaigns[0].amountRaised, 13, "Campaign increases exactly once by £3");
    assert.equal(org.totalRaised, 13, "Public raised amount uses the intended donation");
    assert.equal(org.totalOwedGbp, toOrgGbp, "Missing owed aggregate starts at zero");
    assert.equal(state.emails.length, 1, "Replay must not send another confirmation");
    const html = state.emails[0].htmlContent;
    assert.match(html, /£3\.00/);
    assert.ok(html.includes(feeCovered
      ? "Your donation £3.00 · Fee cover £0.25 · Total charged £3.25"
      : "Your donation £3.00 · Total charged £3.00"));
    assert.ok(html.includes(feeCovered
      ? "Test Organisation receives £2.85 · Root ProjX platform fee £0.15 (5%)"
      : "Test Organisation receives £2.60 · Root ProjX platform fee £0.15 (5%) · Card processing £0.25"));
    assert.doesNotMatch(html.replace(/<[^>]*>/g, ""), /100%/);
    assert.doesNotMatch(state.checkout.line_items[0].price_data.product_data.description, /100%/);
    assert.equal(state.errors.length, 0, "No swallowed side-effect failures");
    t.diagnostic(JSON.stringify({
      feeCovered, chargedGbp: grossPence / 100,
      recordedAmountGbp: donation.amountGbp,
      recordedGrossAmountGbp: donation.grossAmountGbp,
      recordedNetAmountGbp: donation.netAmountGbp,
      platformFeePence: intentData.application_fee_amount,
      donationDocumentsWritten: writes.length,
      campaignBeforeGbp: 10, campaignAfterGbp: org.campaigns[0].amountRaised,
      orgTotalRaisedAfterGbp: org.totalRaised,
      orgTotalOwedAfterGbp: org.totalOwedGbp,
      toOrgGbp: donation.toOrgGbp,
      feeCoverGbp: donation.feeCoverGbp,
    }));
  });
}

test("invoice donations use the same accounting and add to existing owed totals", async () => {
  const {webhooks, state} = await isolatedRouters();
  state.documents.get("organisations/test-org").totalOwedGbp = 5;
  const metadata = {
    userId:"test-user", orgId:"test-org", orgName:"Test Organisation",
    campaignId:"test-campaign",
  };
  const event = {
    id:"evt_invoice_synthetic", object:"event", type:"invoice.payment_succeeded",
    created:1791979200, livemode:false,
    data:{object:{
      id:"in_synthetic", amount_paid:300, currency:"gbp",
      parent:{subscription_details:{subscription:"sub_synthetic", metadata}},
      status_transitions:{paid_at:1791979200},
    }},
  };
  const log = {info(){}, warn(){}, error(obj: unknown){state.errors.push(obj);}};
  await invoke(webhooks, "/stripe", {
    body:Buffer.from(JSON.stringify(event)),
    headers:{"stripe-signature":"synthetic-signature"}, log,
  });
  const donation = state.writes.find((w: any) => w.collection === "donations").data;
  assert.equal(donation.intendedGbp, 3, "Missing original metadata falls back to charged amount");
  assert.equal(donation.chargedGbp, 3);
  assert.equal(donation.platformFeeGbp, 0.15);
  assert.equal(donation.toOrgGbp, 2.60, "Unavailable card country uses UK fee estimate");
  assert.equal(donation.feeCoverGbp, 0);
  assert.equal(donation.amountGbp, 3);
  assert.equal(donation.netAmountGbp, 2.60);
  const org = state.documents.get("organisations/test-org");
  assert.equal(org.totalRaised, 13);
  assert.equal(org.campaigns[0].amountRaised, 13);
  assert.equal(org.totalOwedGbp, 7.60);
  assert.equal(state.errors.length, 0);
});

test("expanded international card country selects international fees", async () => {
  const {webhooks, state} = await isolatedRouters();
  const event = {
    type:"payment_intent.succeeded",
    data:{object:{
      id:"pi_international_synthetic", amount:300, currency:"gbp",
      application_fee_amount:15,
      latest_charge:{payment_method_details:{card:{country:"US"}}},
      metadata:{orgId:"test-org", originalAmountPence:"300"},
    }},
  };
  const log = {info(){}, warn(){}, error(obj: unknown){state.errors.push(obj);}};
  await invoke(webhooks, "/stripe", {
    body:Buffer.from(JSON.stringify(event)),
    headers:{"stripe-signature":"synthetic-signature"}, log,
  });
  const donation = state.writes.find((w: any) => w.collection === "donations").data;
  assert.equal(donation.toOrgGbp, 2.55);
  assert.equal(donation.estimatedStripeFeeGbp, 0.30);
  assert.equal(state.errors.length, 0);
});
