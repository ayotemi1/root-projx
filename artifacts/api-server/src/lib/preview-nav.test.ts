// Part 5: "Preview as a donor" saves first and never opens on a failed save.
import assert from "node:assert/strict";
import test from "node:test";
// Runtime import by URL so the API tsc never traverses web sources.
type Flush = () => Promise<boolean>;
const webUrl = new URL("../../../web/src/lib/preview-nav.ts", import.meta.url).href;
const { flushProfile, openPreviewAfterSave, registerProfileFlush } = (await import(webUrl)) as {
  flushProfile: (orgId: string) => Promise<boolean>;
  openPreviewAfterSave: (save: Flush, path: string) => Promise<boolean>;
  registerProfileFlush: (orgId: string, fn: Flush) => () => void;
};

type FakeTab = { closed: boolean; opener: unknown; location: { href: string }; close: () => void };
function fakeWindow() {
  const tabs: FakeTab[] = [];
  const w = {
    location: { href: "/dashboard" },
    open: () => {
      const t: FakeTab = { closed: false, opener: {}, location: { href: "about:blank" }, close() { this.closed = true; } };
      tabs.push(t);
      return t;
    },
  };
  (globalThis as unknown as { window: unknown }).window = w;
  return { w, tabs };
}

test("profile preview opens only after every mounted section saved", async () => {
  const { tabs } = fakeWindow();
  const order: string[] = [];
  const off1 = registerProfileFlush("org1", async () => { order.push("identity"); return true; });
  const off2 = registerProfileFlush("org1", async () => { order.push("story"); return true; });
  const ok = await openPreviewAfterSave(() => flushProfile("org1"), "/organisations/org1?preview=1");
  assert.equal(ok, true);
  assert.deepEqual(order.sort(), ["identity", "story"]);
  assert.equal(tabs[0].location.href, "/organisations/org1?preview=1");
  assert.equal(tabs[0].opener, null);
  off1(); off2();
});

test("a failed section save closes the tab and never navigates", async () => {
  const { w, tabs } = fakeWindow();
  const off1 = registerProfileFlush("org2", async () => true);
  const off2 = registerProfileFlush("org2", async () => false);
  const ok = await openPreviewAfterSave(() => flushProfile("org2"), "/organisations/org2?preview=1");
  assert.equal(ok, false);
  assert.equal(tabs[0].closed, true);
  assert.equal(tabs[0].location.href, "about:blank");
  assert.equal(w.location.href, "/dashboard");
  off1(); off2();
});

test("a thrown save counts as failure; unregistered sections are not flushed", async () => {
  fakeWindow();
  let called = false;
  const off = registerProfileFlush("org3", async () => { called = true; throw new Error("network"); });
  assert.equal(await flushProfile("org3"), false);
  off();
  called = false;
  assert.equal(await flushProfile("org3"), true);
  assert.equal(called, false);
});
