import assert from "node:assert/strict";
import test from "node:test";
import { onboardingOrigin, stripeCountry } from "./stripe-onboarding.ts";

test("live onboarding callbacks never prefer an inherited development domain", () => {
  assert.equal(onboardingOrigin({
    REPLIT_DEPLOYMENT: "1", REPLIT_DEV_DOMAIN: "workspace.example.test",
  }), "https://rootprojx.com");
  assert.equal(onboardingOrigin({ NODE_ENV: "production" }), "https://rootprojx.com");
  assert.equal(onboardingOrigin({ REPLIT_DEV_DOMAIN: "workspace.example.test" }), "https://workspace.example.test");
});

test("country names and ISO codes are normalized without silently defaulting to GB", () => {
  for (const [input, output] of [
    ["United Kingdom", "GB"], ["UK", "GB"], ["Jamaica", "JM"],
    [" Kenya ", "KE"], ["us", "US"], ["Turkey", "TR"],
  ]) assert.equal(stripeCountry(input), output);
  for (const input of [null, undefined, "", "All", "not a country"]) {
    assert.equal(stripeCountry(input), null);
  }
});
