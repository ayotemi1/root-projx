import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

// Exercise the browser helper without opening Stripe or creating live accounts.
const bundle = await build({
  entryPoints: [new URL("../../../web/src/lib/stripe-onboarding-tab.ts", import.meta.url).pathname],
  bundle: true, write: false, format: "cjs", platform: "node",
});
const mod = { exports: {} as any };
new Function("module", "exports", bundle.outputFiles[0].text)(mod, mod.exports);
const { openStripeOnboardingTab } = mod.exports;

function browserFixture() {
  const events: string[] = [];
  const tab = {
    opener: {} as unknown,
    closed: false,
    close() { events.push("close"); this.closed = true; },
    location: { replace(url: string) { events.push(`navigate:${url}`); } },
  };
  const browser = {
    open(url: string, target: string) {
      events.push(`open:${url}:${target}`);
      return tab;
    },
  };
  return { events, tab, browser };
}

test("Stripe opens a separate tab before the request and severs its opener", async () => {
  const { events, tab, browser } = browserFixture();
  await openStripeOnboardingTab(async () => {
    events.push("request");
    assert.equal(tab.opener, null);
    return { url: "https://connect.stripe.com/synthetic" };
  }, browser);
  assert.deepEqual(events, [
    "open:about:blank:_blank", "request", "navigate:https://connect.stripe.com/synthetic",
  ]);
});

test("blocked pop-ups show an error without requesting an onboarding link", async () => {
  let requested = false;
  await assert.rejects(openStripeOnboardingTab(async () => {
    requested = true;
  }, { open: () => null }), /allow pop-ups/);
  assert.equal(requested, false);
});

test("Stripe rejection closes the blank tab and preserves the exact error", async () => {
  const { events, browser } = browserFixture();
  const error = new Error("Stripe rejected this request.");
  await assert.rejects(openStripeOnboardingTab(async () => { throw error; }, browser),
    (actual: unknown) => actual === error);
  assert.deepEqual(events, ["open:about:blank:_blank", "close"]);
});

test("closing the pending tab never redirects the original dashboard", async () => {
  const { events, tab, browser } = browserFixture();
  await assert.rejects(openStripeOnboardingTab(async () => {
    tab.closed = true;
    return { url: "https://connect.stripe.com/synthetic" };
  }, browser), /tab was closed/);
  assert.ok(events.every(event => !event.startsWith("navigate:")));
});
