import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

const webRoot = new URL("../../../web/", import.meta.url);
const webRequire = createRequire(new URL("package.json", webRoot));
const { createElement } = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const result = await build({
  entryPoints: [new URL("src/components/bank-transfer-approvals.tsx", webRoot).pathname],
  bundle: true, write: false, format: "cjs", platform: "node", packages: "external", jsx: "automatic",
});
const mod = { exports: {} as any };
new Function("require", "module", "exports", result.outputFiles[0].text)(webRequire, mod, mod.exports);
const { BankTransferApprovals } = mod.exports;
const pending = { _id: "pending", name: "Pending Organisation", country: "Jamaica", payoutMethod: "bank_transfer", payoutManualRequested: true, payoutManualApproved: false };
const render = (overrides: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(BankTransferApprovals, {
  organisations: [pending], loading: false, error: "", onReview() {}, onRefresh() {}, ...overrides,
}));

test("admin bank-transfer queue shows requested, unapproved organisations even with no donations", () => {
  const html = render({ organisations: [
    pending,
    { ...pending, _id: "approved", name: "Already Approved", payoutManualApproved: true },
    { ...pending, _id: "switched", name: "Switched to Stripe", payoutMethod: "stripe" },
    { ...pending, _id: "unset", name: "No Request", payoutManualRequested: false },
  ] });
  assert.match(html, /Bank transfer approvals \(1\)/);
  assert.match(html, /button-review-bank-transfer-pending/);
  assert.match(html, /Pending Organisation/);
  assert.doesNotMatch(html, /Already Approved|Switched to Stripe|No Request/);
  assert.match(html, /does not send a payout/);
});

test("admin approval queue keeps loading and errors distinct from a genuinely empty queue", () => {
  assert.match(render({ organisations: [], loading: true }), /Loading bank-transfer requests/);
  const error = render({ organisations: [], error: "Could not load requests" });
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(error, /No bank-transfer requests awaiting approval/);
  assert.match(render({ organisations: [] }), /No bank-transfer requests awaiting approval/);
});
