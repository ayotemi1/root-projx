import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";
import { activePayoutMethod, resolvePayoutMethod, manualPayoutLabel, withoutPrivatePayoutSetup } from "./payout-setup.ts";

// Real route handlers and auth middleware, with every external-service boundary
// replaced. Never creates a real account, onboarding link, email or bank payee.
async function fixture() {
  const mocks: Record<string, string> = {
    state: `export const state = {docs:new Map(), writes:[], stripeCalls:[]};`,
    "firebase-rest.js": `
      import {state} from "setup-test:state";
      export const getServerToken = async () => "synthetic-server";
      export const firebaseLookup = async token => {
        const uid = token === "org" ? "org" : token === "supporter" ? "supporter" : token === "pending" ? "pending" : null;
        return uid ? {uid,email:uid+"@example.test"} : null;
      };
      export const fsGet = async (collection,id) => structuredClone(state.docs.get(collection+"/"+id) ?? null);
      export const fsPatch = async (collection,id,patch) => {
        state.writes.push({collection,id,patch:structuredClone(patch)});
        const key=collection+"/"+id;
        state.docs.set(key,{...state.docs.get(key),...structuredClone(patch)});
      };
      export const fsCreate = async (collection,data) => {
        const id="application";
        await fsPatch(collection,id,{...data,_id:id});
        return id;
      };
      export const fsList = async collection => [...state.docs.entries()]
        .filter(([key])=>key.startsWith(collection+"/")).map(([,doc])=>structuredClone(doc));
      export const fsQuery = async (collection,filters) =>
        (await fsList(collection)).filter(doc=>filters.every(f=>doc[f.field]===f.value));
      export const firebaseSignUp = async () => ({uid:"applicant",idToken:"synthetic-applicant"});
      export const firebaseSignIn = firebaseSignUp;
      export const firebaseUpdateProfile = async () => {};
      export const firebaseSendPasswordResetEmail = async () => {};
    `,
    "brevo.js": `
      export const brevoSendEmail = async () => {};
      export const orgApplicationReceivedHtml = () => "";
      export const orgAcceptedHtml = () => "";
      export const orgDeclinedHtml = () => "";
      export const internalNotificationHtml = () => "";
    `,
    "stripeClient.js": `
      import {state} from "setup-test:state";
      export const getUncachableStripeClient = async () => ({
        accounts:{
          create:async params=>{state.stripeCalls.push(params);return {id:"acct_synthetic"};},
          retrieve:async()=>({payouts_enabled:true,charges_enabled:true})
        },
        accountLinks:{create:async()=>({url:"https://example.test/onboarding"})}
      });
    `,
  };
  const result = await build({
    stdin: {
      contents: `
        export {default as applications} from "./routes/applications.ts";
        export {default as payout} from "./routes/payout-setup.ts";
        export {default as stripe} from "./routes/stripe-connect.ts";
        export {state} from "setup-test:state";
      `,
      resolveDir: new URL("../", import.meta.url).pathname,
      loader: "ts",
    },
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    define: { "process.env.ADMIN_PASSWORD": JSON.stringify("synthetic-admin-password") },
    plugins: [{
      name: "mock-services",
      setup(b) {
        b.onResolve({ filter: /^(setup-test:state)$|\/(firebase-rest|brevo|stripeClient)\.js$/ }, args => ({
          path: args.path.startsWith("setup-test:") ? "state" : args.path.split("/").at(-1)!,
          namespace: "setup-test",
        }));
        b.onLoad({ filter: /.*/, namespace: "setup-test" }, args => ({
          contents: mocks[args.path]!, loader: "js",
        }));
      },
    }],
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(
    createRequire(import.meta.url), module, module.exports,
  );
  const api = module.exports;
  api.state.docs.set("users/org", { accountType: "organisation", approvalStatus: "approved" });
  api.state.docs.set("users/pending", { accountType: "organisation", approvalStatus: "pending" });
  api.state.docs.set("users/supporter", { accountType: "supporter" });
  api.state.docs.set("organisations/org", { name: "Test Org" });
  return api;
}

const adminHeaders = {
  "x-admin-token": createHmac("sha256", "synthetic-admin-password")
    .update("rootprojx-admin-session").digest("hex"),
};

async function invoke(router: any, path: string, method: string, options: Record<string, unknown> = {}) {
  const route = router.stack.find((layer: any) =>
    layer.route?.path === path && layer.route.methods[method.toLowerCase()])?.route;
  assert.ok(route, `Missing route ${method} ${path}`);
  let status = 200;
  let body: any;
  const req = {
    method, body: {}, headers: {}, params: {}, query: {},
    log: { error() {}, info() {} }, ...options,
  };
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; },
    redirect(url: string) { status = 302; body = { url }; },
  };
  for (const layer of route.stack) {
    let next = false;
    await layer.handle(req, res, () => { next = true; });
    if (!next) break;
  }
  return { status, body };
}

test("payout selection is exclusive and legacy setup is inferred without inventing a method", () => {
  assert.equal(activePayoutMethod({}), null);
  assert.equal(activePayoutMethod({ country: "Jamaica" }), null);
  assert.equal(activePayoutMethod({ stripe_account_id: "old", payouts_enabled: true, wise_email: "old@example.test" }), "stripe");
  assert.equal(activePayoutMethod({ wise_email: "old@example.test" }), "wise");
  assert.equal(activePayoutMethod({ payoutMethod: "bank_transfer", stripe_account_id: "old", wise_email: "old@example.test" }), "bank_transfer");
});

test("manual payee labels accept short reminders but reject banking details", () => {
  assert.equal(manualPayoutLabel(" NCB Jamaica — payee saved 20 Oct "), "NCB Jamaica — payee saved 20 Oct");
  assert.equal(manualPayoutLabel(""), null);
  assert.equal(manualPayoutLabel(null), null);
  for (const label of ["12345678", "12-34-56", "GB82 WEST 1234 5698 7654 32", "IBAN saved", "routing number saved", "x".repeat(101), 123]) {
    assert.throws(() => manualPayoutLabel(label));
  }
});

test("shared payout resolver maps selected and legacy methods without changing readiness", () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{}, "none"],
    [{ country: "Jamaica" }, "none"],
    [{ payoutMethod: "stripe" }, "stripe_connect"],
    [{ payoutMethod: "wise", stripe_account_id: "acct_old", payouts_enabled: true }, "wise"],
    [{ payoutMethod: "bank_transfer", stripe_account_id: "acct_old", wise_email: "old@example.test" }, "manual"],
    [{ stripe_account_id: "acct_old", payouts_enabled: true, wise_email: "old@example.test" }, "stripe_connect"],
    [{ stripe_account_id: "acct_old" }, "stripe_connect"],
    [{ wise_email: "old@example.test" }, "wise"],
    [{ payoutManualRequested: true }, "manual"],
    [{ payoutManualApproved: true }, "manual"],
    [{ payoutMethod: "invalid" }, "none"],
  ];
  for (const [org, expected] of cases) {
    const before = structuredClone(org);
    assert.equal(resolvePayoutMethod(org), expected);
    assert.deepEqual(org, before, "Resolving must not mutate the organisation");
    assert.equal(withoutPrivatePayoutSetup(org).payoutMethod, expected);
  }
});

test("public organisation projections expose the resolved method but omit private setup metadata", () => {
  const org = {
    name: "Test Org", country: null, payoutMethod: "bank_transfer",
    payoutManualRequested: true, payoutManualApproved: true,
    payoutManualLabel: "NCB Jamaica — payee saved 20 Oct",
  };
  assert.deepEqual(withoutPrivatePayoutSetup(org), { name: "Test Org", country: null, payoutMethod: "manual" });
  assert.equal(org.payoutManualApproved, true, "Projection must not change the stored setup");
});

test("application country is required, stored, and carried into the approved organisation", async () => {
  const { applications, state } = await fixture();
  const body = { orgName: "Test Org", contactName: "Test Applicant", email: "org@example.test", password: "synthetic-password", sectors: ["Education"] };
  for (const country of [undefined, "", "  ", null, 7, "All"]) {
    const response = await invoke(applications, "/applications/org", "POST", { body: { ...body, country } });
    assert.equal(response.status, 400);
  }
  assert.equal(state.writes.length, 0, "Missing country must fail before any external account or document write");
  assert.equal((await invoke(applications, "/applications/org", "POST", { body: { ...body, country: " Canada " } })).status, 201);
  assert.equal(state.docs.get("org_applications/application").country, "Canada");
  // An authenticated retry also supplies country on a legacy pending record.
  delete state.docs.get("org_applications/application").country;
  assert.equal((await invoke(applications, "/applications/org", "POST", { body: { ...body, country: "Canada" } })).status, 200);
  assert.equal(state.docs.get("org_applications/application").country, "Canada");
  const approved = await invoke(applications, "/admin/applications/:id/approve", "POST", {
    headers: adminHeaders, params: { id: "application" },
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(state.docs.get("organisations/applicant").country, "Canada");
});

test("approving a legacy application leaves country unknown rather than defaulting to Jamaica", async () => {
  const { applications, state } = await fixture();
  state.docs.set("org_applications/legacy", {
    uid: "legacy-org", orgName: "Legacy Org", contactName: "Test Applicant",
    email: "legacy@example.test", sectors: [], status: "pending",
  });
  const result = await invoke(applications, "/admin/applications/:id/approve", "POST", {
    headers: adminHeaders, params: { id: "legacy" },
  });
  assert.equal(result.status, 200);
  assert.equal(state.docs.get("organisations/legacy-org").country, null);
});

test("only approved organisation owners can select a method; bank requests cannot self-approve", async () => {
  const { payout, state } = await fixture();
  for (const headers of [{}, { authorization: "Bearer supporter" }, { authorization: "Bearer pending" }]) {
    const result = await invoke(payout, "/payout/setup", "PUT", { headers, body: { method: "bank_transfer" } });
    assert.ok([401, 403].includes(result.status));
  }
  assert.equal(state.writes.length, 0);
  const headers = { authorization: "Bearer org" };
  assert.deepEqual((await invoke(payout, "/payout/setup", "GET", { headers })).body, {
    method: null, payoutManualRequested: false, payoutManualApproved: false, payoutManualLabel: null,
  });
  for (const extra of [{ payoutManualApproved: true }, { accountNumber: "synthetic" }, { payoutManualLabel: "not owner editable" }]) {
    assert.equal((await invoke(payout, "/payout/setup", "PUT", { headers, body: { method: "bank_transfer", ...extra } })).status, 400);
  }
  const requested = await invoke(payout, "/payout/setup", "PUT", { headers, body: { method: "bank_transfer" } });
  assert.equal(requested.status, 200);
  assert.equal(requested.body.payoutManualRequested, true);
  assert.equal(requested.body.payoutManualApproved, false);
  assert.deepEqual(state.writes.at(-1).patch, { payoutMethod: "bank_transfer", payoutManualRequested: true });
  assert.equal(state.docs.get("organisations/org").payoutManualApproved, undefined);
  assert.equal((await invoke(payout, "/payout/setup", "GET", { headers })).body.method, "bank_transfer");
});

test("admin approval requires a request, rejects sensitive data, persists the label and survives method switches", async () => {
  const { applications, payout, state } = await fixture();
  const route = "/admin/organisations/:id/manual-payout";
  const params = { id: "org" };
  const body = { payoutManualApproved: true, payoutManualLabel: "NCB Jamaica — payee saved 20 Oct" };
  assert.equal((await invoke(applications, route, "PATCH", { params, body })).status, 401);
  assert.equal((await invoke(applications, route, "PATCH", { params, body, headers: adminHeaders })).status, 409);
  const headers = { authorization: "Bearer org" };
  await invoke(payout, "/payout/setup", "PUT", { headers, body: { method: "bank_transfer" } });
  for (const invalid of [{ ...body, iban: "synthetic" }, { ...body, payoutManualLabel: "12-34-56" }]) {
    assert.equal((await invoke(applications, route, "PATCH", { params, body: invalid, headers: adminHeaders })).status, 400);
  }
  assert.equal((await invoke(applications, route, "PATCH", { params, body, headers: adminHeaders })).status, 200);
  assert.deepEqual(state.writes.at(-1).patch, body);
  let saved = (await invoke(payout, "/payout/setup", "GET", { headers })).body;
  assert.equal(saved.payoutManualApproved, true);
  assert.equal(saved.payoutManualLabel, body.payoutManualLabel);
  await invoke(payout, "/payout/setup", "PUT", { headers, body: { method: "wise" } });
  assert.equal((await invoke(applications, route, "PATCH", { params, body, headers: adminHeaders })).status, 409, "An old bank request cannot approve a different active method");
  saved = (await invoke(payout, "/payout/setup", "GET", { headers })).body;
  assert.equal(saved.method, "wise");
  await invoke(payout, "/payout/setup", "PUT", { headers, body: { method: "bank_transfer" } });
  assert.equal((await invoke(payout, "/payout/setup", "GET", { headers })).body.payoutManualApproved, true);
});

test("Stripe onboarding accepts an authenticated POST and returns a URL without storing bank details", async () => {
  const { stripe, state } = await fixture();
  assert.equal((await invoke(stripe, "/stripe/connect/onboard", "POST")).status, 401);
  const result = await invoke(stripe, "/stripe/connect/onboard", "POST", {
    headers: { authorization: "Bearer org" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.url, "https://example.test/onboarding");
  assert.deepEqual(state.writes.at(-1).patch, { stripe_account_id: "acct_synthetic", payouts_enabled: false });
});
