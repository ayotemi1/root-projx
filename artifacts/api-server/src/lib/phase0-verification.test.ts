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
        documents: new Map(), writes: [], errors: [], checkout: null, event: null
      };
      state.documents.set("organisations/test-org", {
        _id: "test-org", name: "Test Organisation", stripe_account_id: "acct_synthetic",
        totalRaised: 10,
        campaigns: [{_id: "test-campaign", title: "Test Campaign", amountRaised: 10}]
      });
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
      export const brevoSendEmail = async () => {};
      export const donationConfirmationHtml = () => "";
      export const shopOrderConfirmationHtml = () => "";
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

async function invoke(router: any, path: string, req: Record<string, unknown>) {
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
  assert.equal(status, 200, JSON.stringify(body));
  return body;
}

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
      headers: {}, log,
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
    assert.equal(donation.netAmountGbp, 3, "Intended donation is £3 in either case");
    assert.equal(donation.feeCovered, feeCovered);
    assert.equal(donation.feeAmountGbp, feeAmountPence / 100);
    // Report existing legacy accounting separately from intended/net donation.
    assert.equal(donation.amountGbp, (grossPence - 15) / 100);
    const org = state.documents.get("organisations/test-org");
    assert.equal(org.campaigns[0].amountRaised, 13, "Campaign increases exactly once by £3");
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
    }));
  });
}
