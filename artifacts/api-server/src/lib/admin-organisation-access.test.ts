import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  stdin: { contents: 'export * from "./src/lib/admin-organisation-access.ts"', resolveDir: process.cwd() },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { createOrganisationAccess, resolveOrganisationAccess, organisationAccessAllows } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("admin delegation is signed, organisation scoped and expires after an hour", () => {
  const token = createOrganisationAccess("org-a", 1000);
  assert.equal(resolveOrganisationAccess(token, 1001), "org-a");
  assert.equal(resolveOrganisationAccess(token, 3601000), null);
  assert.equal(resolveOrganisationAccess(`${token}changed`, 1001), null);
  assert.equal(resolveOrganisationAccess("not-an-admin-token", 1001), null);
});

test("admin organisation access allows editors, previews and uploads, not other organisations or financial actions", () => {
  for (const [method, path] of [
    ["PATCH", "/api/organisations/org-a"], ["POST", "/api/organisations/org-a/campaigns"],
    ["GET", "/api/organisations/org-a/campaigns/camp-a/preview"],
    ["POST", "/api/organisations/org-a/walkthrough/events"],
    ["POST", "/api/uploads/media"], ["GET", "/api/payouts/my"],
  ]) assert.equal(organisationAccessAllows("org-a", method, path), true, path);
  for (const [method, path] of [
    ["PATCH", "/api/organisations/org-b"], ["PATCH", "/api/organisations/org-ab"],
    ["DELETE", "/api/organisations/org-a"], ["POST", "/api/stripe/connect"],
    ["POST", "/api/admin/payouts/run"], ["PUT", "/api/payout/setup"],
    ["POST", "/api/donations/checkout"], ["GET", "/api/auth/me"],
  ]) assert.equal(organisationAccessAllows("org-a", method, path), false, path);
});

test("real auth middleware validates delegation before replacing Firestore credentials and enforcing owner checks", async () => {
  const bundled = await build({
    stdin: { contents: 'export { requireAuth, optionalAuth } from "./src/lib/auth.ts"; export { createOrganisationAccess } from "./src/lib/admin-organisation-access.ts";', resolveDir: process.cwd() },
    bundle: true, platform: "node", format: "esm", write: false,
    plugins: [{
      name: "mock-firebase",
      setup(plugin) {
        plugin.onResolve({ filter: /firebase-rest\.js$/ }, () => ({ path: "firebase", namespace: "test" }));
        plugin.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: `
          export const getServerToken = async () => "synthetic-server";
          export const fsGet = async (collection, id) => id === "org-a" ? {name:"Org A"} : null;
          export const firebaseLookup = async token => token === "ordinary-user" ? {uid:"supporter",email:"supporter@example.test"} : null;
        ` }));
      },
    }],
  });
  const auth = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  async function invoke(token: string, url: string, optional = false) {
    const req: any = { headers: { authorization: `Bearer ${token}` }, method: "PATCH", originalUrl: url };
    let status = 200, called = false;
    const res: any = { status(code: number) { status = code; return this; }, json() {} };
    await auth[optional ? "optionalAuth" : "requireAuth"](req, res, () => { called = true; });
    return { req, status, called };
  }
  const token = auth.createOrganisationAccess("org-a");
  const allowed = await invoke(token, "/api/organisations/org-a");
  assert.equal(allowed.called, true);
  assert.equal(allowed.req.user.userId, "org-a");
  assert.equal(allowed.req.headers.authorization, "Bearer synthetic-server");
  for (const path of ["/api/organisations/org-b", "/api/admin/payouts/run", "/api/auth/me"]) {
    const rejected = await invoke(token, path);
    assert.equal(rejected.status, 401);
    assert.equal(rejected.called, false);
    assert.equal(rejected.req.user, undefined);
  }
  const optional = await invoke(token, "/api/organisations/org-a", true);
  assert.equal(optional.req.user.userId, "org-a");
  assert.equal((await invoke(`${token}invalid`, "/api/organisations/org-a")).status, 401);
  assert.equal((await invoke(auth.createOrganisationAccess("missing-org"), "/api/organisations/missing-org")).status, 401);
  assert.equal((await invoke("ordinary-user", "/api/organisations/org-a")).req.user.userId, "supporter");
});
