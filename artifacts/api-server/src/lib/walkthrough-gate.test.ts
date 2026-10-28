// Part 1 walkthrough: gating + completion checks (pure logic, no browser).
import assert from "node:assert/strict";
import test from "node:test";
type Check = (c: never) => boolean;
type Step = { id: string; skippable: boolean; completionCheck: Check | null; helper?: (c: never) => unknown };
const gateUrl = new URL("../../../web/src/lib/tour/gate.ts", import.meta.url).href;
const stepsUrl = new URL("../../../web/src/lib/tour/steps.ts", import.meta.url).href;
const { gate, skipGate, navigationSkipGate, worstSaveState } = (await import(gateUrl)) as {
  gate: (i: { checkPassed: boolean | null; alert: string | null; saveState: string | null }) => { ok: boolean; reason?: string; message?: string };
  skipGate: (i: { skippable: boolean; checkPassed: boolean | null; alert: string | null; saveState: string | null }) => { ok: boolean; reason?: string };
  navigationSkipGate: (i: { checkPassed: boolean | null; alert: string | null; saveState: string | null }) => { ok: boolean; reason?: string };
  worstSaveState: (s: (string | null)[]) => string | null;
};
const { TOUR_STEPS } = (await import(stepsUrl)) as { TOUR_STEPS: Step[] };

const S = (id: string) => TOUR_STEPS.find((s) => s.id === id)!;
const camp = { _id: "c1", enabled: false, status: "draft" } as never;
const ctx = (over: Record<string, unknown> = {}) => ({ org: undefined, campaigns: [], campaign: undefined, wt: undefined, ...over }) as never;

test("every walkthrough step can be browsed past without completing its saved-data check", () => {
  for (const step of TOUR_STEPS) {
    const before = step.completionCheck?.(ctx());
    assert.equal(navigationSkipGate({ checkPassed: before ?? null, alert: null, saveState: null }).ok, true, step.id);
    assert.equal(step.completionCheck?.(ctx()), before, `${step.id} completion stays unchanged`);
  }
  assert.equal(S("p-logo").completionCheck!(ctx()), false);
  assert.equal(S("p-payout").completionCheck!(ctx()), false);
});

test("skip to next step never ignores errors or unsaved edits", () => {
  for (const saveState of ["dirty", "saving", "error"]) {
    assert.equal(navigationSkipGate({ checkPassed: false, alert: null, saveState }).ok, false);
  }
  assert.equal(navigationSkipGate({ checkPassed: false, alert: "Upload failed", saveState: "saved" }).ok, false);
});

test("gate blocks on error, alert, saving and dirty even when the check passes", () => {
  assert.equal(gate({ checkPassed: true, alert: null, saveState: "saved" }).ok, true);
  assert.equal(gate({ checkPassed: true, alert: null, saveState: null }).ok, true);
  for (const st of ["error", "saving", "dirty"] as const) assert.equal(gate({ checkPassed: true, alert: null, saveState: st }).ok, false, st);
  const g = gate({ checkPassed: true, alert: "Too long", saveState: "saved" });
  assert.ok(!g.ok && g.reason === "error" && /Too long/.test(g.message ?? ""));
  assert.equal(gate({ checkPassed: false, alert: null, saveState: "saved" }).ok, false);
});

test("action steps (no check) pass only with a clean editor", () => {
  assert.equal(gate({ checkPassed: null, alert: null, saveState: null }).ok, true);
  assert.equal(gate({ checkPassed: null, alert: null, saveState: "dirty" }).ok, false);
});

test("optional Skip permits absent content but never failed, pending or dirty edits", () => {
  const input = { skippable: true, checkPassed: false, alert: null, saveState: "idle" };
  assert.equal(skipGate(input).ok, true);
  for (const saveState of ["error", "saving", "dirty"]) {
    assert.equal(skipGate({ ...input, saveState }).ok, false, saveState);
  }
  assert.equal(skipGate({ ...input, saveState: "saved", alert: "Upload failed" }).ok, false);
  assert.equal(skipGate({ ...input, skippable: false, checkPassed: true }).ok, false);
});

test("tour declarations retain exactly 10 profile and 12 campaign steps and only approved skips", () => {
  assert.equal(TOUR_STEPS.filter(s => s.id.startsWith("p-")).length, 10);
  assert.equal(TOUR_STEPS.filter(s => s.id.startsWith("c-")).length, 12);
  assert.deepEqual(TOUR_STEPS.filter(s => s.skippable).map(s => s.id),
    ["p-metrics", "c-breakdown", "c-locations", "c-video"]);
});

test("worst save state wins", () => {
  assert.equal(worstSaveState(["saved", "dirty", "idle"]), "dirty");
  assert.equal(worstSaveState(["saving", "error"]), "error");
  assert.equal(worstSaveState(["saved", "saving"]), "saving");
  assert.equal(worstSaveState([null, "bogus"]), null);
});

test("c-preview requires a preview of THIS campaign; null id no longer passes", () => {
  const c = S("c-preview").completionCheck!;
  assert.equal(c(ctx({ campaign: camp, wt: { campaignPreviewedAt: "x", campaignPreviewedId: null } })), false);
  assert.equal(c(ctx({ campaign: camp, wt: { campaignPreviewedAt: "x", campaignPreviewedId: "other" } })), false);
  assert.equal(c(ctx({ campaign: undefined, wt: { campaignPreviewedAt: "x", campaignPreviewedId: "c1" } })), false);
  assert.equal(c(ctx({ campaign: camp, wt: { campaignPreviewedAt: "x", campaignPreviewedId: "c1" } })), true);
});

test("c-create accepts an existing saved draft but not an unsaved/foreign one", () => {
  const c = S("c-create").completionCheck!;
  assert.equal(c(ctx({ campaign: camp, campaigns: [camp] })), true);
  assert.equal(c(ctx({ campaign: camp, campaigns: [] })), false);
  assert.equal(c(ctx({ campaign: undefined, campaigns: [camp] })), false);
});

test("p-where offers an identity side-trip only while country is missing; welcome/handoff are non-skippable actions", () => {
  const w = S("p-where");
  assert.ok(w.helper!(ctx({ org: { country: "" } })));
  assert.equal(w.helper!(ctx({ org: { country: "Kenya" } })), null);
  assert.equal(w.completionCheck!(ctx({ org: { country: "", categories: ["education"] } })), false);
  for (const id of ["p-welcome", "p-handoff"]) { assert.equal(S(id).completionCheck, null); assert.equal(S(id).skippable, false); }
  for (const s of TOUR_STEPS) if (s.completionCheck && !/metrics|breakdown|locations|video/.test(s.id)) assert.equal(s.skippable, false, s.id);
});

test("c-publish: enabled alone is not enough while a saved private revision is unpublished", () => {
  const c = S("c-publish").completionCheck!;
  const live = { _id: "c1", enabled: true, status: "active", hasUnpublishedChanges: false } as never;
  const pending = { _id: "c1", enabled: true, status: "active", hasUnpublishedChanges: true } as never;
  const legacy = { _id: "c1", enabled: true, status: "active" } as never;
  const draft = { _id: "c1", enabled: false, status: "draft", hasUnpublishedChanges: false } as never;
  assert.equal(c(ctx({ campaign: pending, campaigns: [pending] })), false);
  assert.equal(c(ctx({ campaign: live, campaigns: [live] })), true); // replay of an already-published campaign
  assert.equal(c(ctx({ campaign: legacy, campaigns: [legacy] })), true);
  assert.equal(c(ctx({ campaign: draft, campaigns: [draft] })), false);
  assert.equal(c(ctx({ campaign: live, campaigns: [] })), false);
});
