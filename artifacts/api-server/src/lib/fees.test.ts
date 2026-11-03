import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

// Isolated processes ensure tests neither depend on nor alter configured secrets
// and each import evaluates the module's environment-based constant afresh.
function evaluateFees(env: NodeJS.ProcessEnv) {
  const moduleUrl = new URL("./fees.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types",
    "--input-type=module",
    "-e",
    `import { MIN_DONATION_PENCE, PLATFORM_FEE_PERCENT, platformFeePence } from ${JSON.stringify(moduleUrl)};
     console.log(JSON.stringify({
       minimum: MIN_DONATION_PENCE,
       percent: PLATFORM_FEE_PERCENT,
       fee: platformFeePence(10000),
       rounded: platformFeePence(101),
       zero: platformFeePence(0)
     }));`,
  ], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("platform fee defaults to 5% and rounds to whole pence", () => {
  assert.deepEqual(evaluateFees({}), {
    minimum: 300, percent: 5, fee: 500, rounded: 5, zero: 0,
  });
});

test("platform fee honours STRIPE_PLATFORM_FEE_PERCENT override", () => {
  assert.deepEqual(evaluateFees({ STRIPE_PLATFORM_FEE_PERCENT: "7.5" }), {
    minimum: 300, percent: 7.5, fee: 750, rounded: 8, zero: 0,
  });
});

function evaluateAccounting(input: Record<string, unknown>) {
  const moduleUrl = new URL("./fees.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types", "--input-type=module", "-e",
    `import {donationAccounting} from ${JSON.stringify(moduleUrl)};
     console.log(JSON.stringify(donationAccounting(${JSON.stringify(input)})));`,
  ], {env:{}, encoding:"utf8"});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("covered donation accounting uses actual card charge and preserves intended donation", () => {
  assert.deepEqual(evaluateAccounting({chargedPence:325, intendedPence:300, feeCovered:true}), {
    chargedGbp:3.25, intendedGbp:3, platformFeeGbp:0.15,
    feeCovered:true, feeCoverGbp:0.25, toOrgGbp:2.85,
    estimatedStripeFeeGbp:0.25, amountGbp:3, netAmountGbp:2.85, grossAmountGbp:3.25,
  });
});

test("uncovered donation accounting subtracts UK estimated Stripe fees", () => {
  assert.deepEqual(evaluateAccounting({chargedPence:300, intendedPence:300, feeCovered:false, cardCountry:"GB"}), {
    chargedGbp:3, intendedGbp:3, platformFeeGbp:0.15,
    feeCovered:false, feeCoverGbp:0, toOrgGbp:2.60,
    estimatedStripeFeeGbp:0.25, amountGbp:3, netAmountGbp:2.60, grossAmountGbp:3,
  });
});

test("unknown card country defaults to UK and missing intended amount uses the charge", () => {
  const accounting = evaluateAccounting({chargedPence:300, feeCovered:false});
  assert.equal(accounting.intendedGbp, 3);
  assert.equal(accounting.toOrgGbp, 2.60);
  assert.equal(accounting.estimatedStripeFeeGbp, 0.25);
});

test("international card estimate is 3.25% plus 20p, rounded to pence", () => {
  const uncovered = evaluateAccounting({chargedPence:300, intendedPence:300, feeCovered:false, cardCountry:"US"});
  assert.equal(uncovered.estimatedStripeFeeGbp, 0.30);
  assert.equal(uncovered.toOrgGbp, 2.55);
  const covered = evaluateAccounting({chargedPence:330, intendedPence:300, feeCovered:true, cardCountry:"US"});
  assert.equal(covered.feeCoverGbp, 0.30);
  assert.equal(covered.toOrgGbp, 2.85);
});

// Exercise the real route handlers with all authentication, Firestore and Stripe
// dependencies mocked. No accounts, payment objects or database records are created.
async function donationHandlers() {
  const mocks: Record<string, string> = {
    "auth.js": `
      export const requireAuth = (_req, _res, next) => next();
      export const optionalAuth = requireAuth;
    `,
    "firebase-rest.js": `
      export const fsMutateCampaigns = async () => {throw Error("Unexpected campaign write");};
      export const getServerToken = async () => "test-only";
      export const fsGet = async (collection, id) => {
        if (id === "no-external-calls") throw Error("Validation ran too late");
        return collection === "organisations"
          ? {name:"Test Org", stripe_account_id:"acct_test"}
          : {email:"test@example.test", stripeCustomerId:"cus_test"};
      };
      export const fsPatch = async () => ({});
      export const fsQuery = async () => [];
    `,
    "stripeClient.js": `
      export const getStripePublishableKey = async () => "test-only";
      export const getUncachableStripeClient = async () => ({
        customers:{search:async()=>({data:[{id:"cus_test"}]})},
        paymentIntents:{create:async()=>({id:"pi_test",client_secret:"test-only"})},
        prices:{create:async()=>({id:"price_test"})},
        subscriptions:{create:async()=>({
          id:"sub_test",latest_invoice:{payment_intent:{client_secret:"test-only"}}
        })},
        checkout:{sessions:{create:async()=>({id:"cs_test",url:"https://example.test/checkout"})}}
      });
    `,
  };
  const result = await build({
    entryPoints: [new URL("../routes/donations.ts", import.meta.url).pathname],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [{
      name: "mock-donation-services",
      setup(builder) {
        builder.onResolve({ filter: /\/(auth|firebase-rest|stripeClient)\.js$/ }, (args) => ({
          path: args.path.split("/").pop()!,
          namespace: "test-mocks",
        }));
        builder.onLoad({ filter: /.*/, namespace: "test-mocks" }, (args) => ({
          contents: mocks[args.path],
          loader: "js",
        }));
      },
    }],
  });
  const module = { exports: {} as { default?: { stack: any[] } } };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(
    createRequire(import.meta.url), module, module.exports,
  );
  return async (path: string, body: Record<string, unknown>) => {
    const route = module.exports.default!.stack.find((layer) => layer.route?.path === path).route;
    let status = 200;
    let payload: Record<string, unknown> = {};
    const response = {
      status(code: number) { status = code; return this; },
      json(data: Record<string, unknown>) { payload = data; },
    };
    await route.stack.at(-1).handle({
      body,
      user: { userId: "test-user" },
      headers: { authorization: "Bearer test-only" },
      log: { error() {} },
    }, response);
    return { status, payload };
  };
}

test("every donation endpoint enforces the £3 boundary before external calls", async (t) => {
  const request = await donationHandlers();
  for (const endpoint of ["payment-intent", "guest-payment-intent", "subscription", "checkout", "anonymous-checkout"]) {
    await t.test(endpoint, async () => {
      const usesPence = endpoint.endsWith("checkout");
      for (const pence of [-100, 0, 100, 299]) {
        const result = await request(`/donations/${endpoint}`, {
          orgId: "no-external-calls",
          guestEmail: "test@example.test",
          ...(usesPence ? { amountPence: pence } : { amountGbp: pence / 100 }),
        });
        assert.deepEqual(result, { status: 400, payload: { error: "Minimum donation is £3." } });
      }
      for (const pence of [300, 301]) {
        const result = await request(`/donations/${endpoint}`, {
          orgId: "test-org",
          guestEmail: "test@example.test",
          ...(usesPence ? { amountPence: pence } : { amountGbp: pence / 100 }),
        });
        assert.equal(result.status, 200, JSON.stringify(result.payload));
      }
      if (!usesPence) {
        const result = await request(`/donations/${endpoint}`, {
          orgId: "no-external-calls", guestEmail: "test@example.test", amountGbp: 2.999,
        });
        assert.equal(result.status, 400, "Subminimum amounts must not round up to £3");
      }
    });
  }
});

test("checkout minimum uses the intended amount, not the fee-covered gross", async () => {
  const request = await donationHandlers();
  for (const endpoint of ["checkout", "anonymous-checkout"]) {
    for (const feeCovered of [true, false]) {
      for (const originalAmountPence of [0, 100, 299]) {
        const result = await request(`/donations/${endpoint}`, {
          orgId: "no-external-calls", amountPence: 325, originalAmountPence, feeCovered,
        });
        assert.deepEqual(result, { status: 400, payload: { error: "Minimum donation is £3." } });
      }
    }
    const accepted = await request(`/donations/${endpoint}`, {
      orgId: "test-org", amountPence: 325, originalAmountPence: 300, feeCovered: true,
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.payload));
    const missingOriginal = await request(`/donations/${endpoint}`, {
      orgId: "no-external-calls", amountPence: 325, feeCovered: true,
    });
    assert.equal(missingOriginal.status, 400, "Covered fees require an intended amount");
  }
});
