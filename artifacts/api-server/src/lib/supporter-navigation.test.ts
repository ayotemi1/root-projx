import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";
import {
  supporterNavigation, supporterMobileNavigation, isSupporterNavigationActive,
  isSupporterPath, shouldUseSupporterLayout,
} from "../../../web/src/lib/supporter-navigation.ts";

const webRoot = new URL("../../../web/", import.meta.url);
const webRequire = createRequire(new URL("package.json", webRoot));
const { createElement } = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const { Router } = webRequire("wouter");
const { QueryClient, QueryClientProvider } = webRequire("@tanstack/react-query");
const supporter = {
  id: "supporter-layout-fixture", name: "Test Supporter", avatarInitials: "TS",
  email: "supporter@example.org", phone: null, accountType: "supporter", createdAt: null,
};

async function render(path: string, options: {
  signedIn?: boolean; route?: string; props?: Record<string, unknown>; exportName?: string;
  seeds?: Array<[unknown[], unknown]>; search?: string;
} = {}) {
  const auth = {
    user: options.signedIn ? supporter : null,
    token: options.signedIn ? "isolated-fixture-token" : null,
    isAuthenticated: !!options.signedIn, isLoading: false,
  };
  const result = await build({
    entryPoints: [new URL(path, webRoot).pathname], bundle: true, write: false,
    platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    loader: { ".css": "empty" }, alias: { "@": new URL("src/", webRoot).pathname },
    define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
    plugins: [{
      name: "isolated-supporter-auth",
      setup(b) {
        b.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: "auth", namespace: "isolated" }));
        b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({
          contents: `export const useAuth=()=>({...${JSON.stringify(auth)},logout:async()=>{},refreshUser:async()=>{}});`,
        }));
      },
    }],
  });
  const mod = { exports: {} as Record<string, any> };
  const requireMock = (name: string) => name === "wouter"
    ? { ...webRequire(name), useSearch: () => options.search ?? "" }
    : webRequire(name);
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(requireMock, mod, mod.exports);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const [key, value] of options.seeds ?? []) client.setQueryData(key, value);
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { search: "", hash: "" } } });
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(Router, { hook: () => [options.route ?? "/feed", () => {}] },
        createElement(mod.exports[options.exportName ?? "default"], options.props ?? { children: "Page content" }))));
  } finally {
    client.clear();
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("all eight supporter destinations are unique, real routes and include five core phone tabs", async () => {
  assert.deepEqual(supporterNavigation.map(item => item.label), [
    "Home", "Discover", "Create", "Inbox", "Notifications", "Profile", "Saved", "Giving History",
  ]);
  assert.equal(new Set(supporterNavigation.map(item => item.href)).size, 8);
  const app = await readFile(new URL("src/App.tsx", webRoot), "utf8");
  for (const item of supporterNavigation) assert.ok(app.includes(`path="${item.href}"`), `missing ${item.href} route`);
  assert.deepEqual(supporterMobileNavigation, ["home", "discover", "create", "inbox", "profile"]);
});

test("supporter layout is scoped to its routes and never replaces organisation, admin, signup or payment shells", () => {
  for (const item of supporterNavigation) {
    assert.equal(isSupporterPath(`${item.href}/?test=1#section`), true);
    assert.equal(shouldUseSupporterLayout(item.href, "supporter"), true);
    assert.equal(shouldUseSupporterLayout(item.href, "organisation"), false);
  }
  for (const path of ["/", "/register", "/login", "/dashboard", "/admin", "/donate/org-id", "/campaigns/test", "/organisations/test"]) {
    assert.equal(shouldUseSupporterLayout(path, "supporter"), false, path);
  }
  assert.equal(shouldUseSupporterLayout("/feed", null), true, "public preview retains the public feed");
});

test("navigation highlights one destination, including the existing account alias and browser-back paths", () => {
  for (const item of supporterNavigation) {
    assert.deepEqual(supporterNavigation.filter(nav => isSupporterNavigationActive(nav, `${item.href}?test=1`)), item.id === "create" ? [] : [item]);
  }
  assert.equal(supporterNavigation.filter(nav => isSupporterNavigationActive(nav, "/account#profile"))[0]?.id, "profile");
});

test("Create is an unhighlighted action in both supporter and organisation navigation", async () => {
  const shell = await render("src/components/supporter/SupporterLayout.tsx", { signedIn: true, route: "/create" });
  assert.doesNotMatch(shell, /is-create|aria-current="page"/);
  assert.match(shell, /class="rps-nav-item"[^>]*data-testid="link-nav-create"/);
  assert.match(shell, /class="rps-tab"[^>]*data-testid="link-tab-create"/);
  const styles = await readFile(new URL("src/components/supporter/supporter-create.css", webRoot), "utf8");
  assert.doesNotMatch(styles, /is-create|aria-expanded="true"/);
  const orgStyles = await readFile(new URL("src/components/dashboard/operations.css", webRoot), "utf8");
  assert.ok(orgStyles.includes('.ops-navitem:not([data-nav-action="create"])[data-state="active"]'));
  const dashboard = await readFile(new URL("src/pages/dashboard.tsx", webRoot), "utf8");
  assert.match(dashboard, /value="posts" className="ops-navitem" data-nav-action="create"/);
});

test("real supporter shell links every destination and never invents guest notifications or follows", async () => {
  const html = await render("src/components/supporter/SupporterLayout.tsx");
  for (const item of supporterNavigation) assert.ok(html.includes(`href="${item.href}"`), item.href);
  assert.match(html, /Page content/);
  assert.match(html, /Sign in/);
  assert.match(html, /Root ProjX/);
  assert.doesNotMatch(html, /href="#"|Humanity Ova Vanity|Ava Morgan/);
  assert.match(html, /aria-current="page"/);
  const bottom = html.match(/<nav class="rps-bottom"[\s\S]*?<\/nav>/)?.[0] ?? "";
  const overflow = html.match(/<nav id="rps-mmenu"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.match(html, /aria-expanded="false" aria-controls="rps-mmenu"/);
  for (const item of supporterNavigation) {
    const phoneNavigation = supporterMobileNavigation.includes(item.id) ? bottom : overflow;
    assert.ok(phoneNavigation.includes(`href="${item.href}"`), `missing mobile link ${item.href}`);
  }
});

test("followed-organisations panel uses authenticated follows and their actual logo links", async () => {
  const html = await render("src/components/supporter/SupporterLayout.tsx", {
    signedIn: true,
    seeds: [[["follows", "my", "isolated-fixture-token"], [
      { _id: "followed-fixture", name: "Fixture Community", logo: "/fixture-logo.png", verified: true },
    ]]],
  });
  assert.match(html, /Fixture Community/);
  assert.match(html, /href="\/organisations\/followed-fixture"/);
  assert.match(html, /src="\/fixture-logo\.png"/);
  assert.match(html, /Sign out/);
});

test("signed-in supporter Create triggers open a chooser instead of navigating away", async () => {
  const shell = await render("src/components/supporter/SupporterLayout.tsx", { signedIn: true });
  assert.match(shell, /<button[^>]*aria-haspopup="dialog"[^>]*data-testid="link-nav-create"/);
  assert.match(shell, /<button[^>]*aria-haspopup="dialog"[^>]*data-testid="link-tab-create"/);
  assert.doesNotMatch(shell, /href="\/create"/);
  const intro = await render("src/components/supporter/SupporterHomeIntro.tsx", {
    signedIn: true, exportName: "SupporterHomeIntro",
  });
  assert.doesNotMatch(intro, /link-composer-create|rps-composer|caught your attention/i);
  assert.match(intro, /Home/);
});

test("each missing supporter composer is explicitly flagged without a fake publishing form", async () => {
  for (const type of ["post", "story", "text"]) {
    const html = await render("src/pages/supporter-placeholder.tsx", {
      signedIn: true, props: { section: "create" }, search: `type=${type}`,
    });
    assert.match(html, /Not built yet/);
    assert.match(html, /Publishing unavailable/);
    assert.match(html, new RegExp(`page-supporter-create-${type}`));
    assert.doesNotMatch(html, /<form|<textarea|type="file"/);
    assert.match(html, /href="\/feed"/);
  }
  for (const type of ["unknown", "__proto__", "constructor"]) {
    const html = await render("src/pages/supporter-placeholder.tsx", {
      props: { section: "create" }, search: `type=${type}`,
    });
    assert.match(html, /Coming in a later stage/);
  }
});

test("unfinished destinations are honest placeholders with working onward navigation", async () => {
  for (const section of ["create", "inbox", "notifications", "saved"]) {
    const html = await render("src/pages/supporter-placeholder.tsx", { props: { section } });
    assert.match(html, /Coming in a later stage/);
    assert.match(html, /href="\/discover"/);
    assert.match(html, /href="\/feed"/);
    assert.doesNotMatch(html, /<textarea|<form|href="#"/);
  }
});

test("Giving History reuses real donation and subscription rendering rather than a dummy history", async () => {
  const html = await render("src/pages/account.tsx", {
    signedIn: true, exportName: "GivingHistoryPage",
    seeds: [
      [["profile"], supporter],
      [["donations", "my"], [{ _id: "donation-fixture", orgName: "Receipt Fixture", amountGbp: 3, currency: "gbp", type: "one_time", createdAt: "2026-11-20" }]],
      [["donations", "recurring", supporter.id], [{ _id: "recurring-fixture", orgId: "recurring-org", orgName: "Monthly Fixture", amountGbp: 5, status: "paused", lastPaidAt: "2026-11-01" }]],
    ],
  });
  assert.match(html, /Giving History/);
  assert.match(html, /Receipt Fixture/);
  assert.match(html, /Monthly Fixture/);
  assert.match(html, /Paused/);
  assert.match(html, /Manage recurring donations/);
  assert.doesNotMatch(html, /My Supporter Wall|Edit public profile/);
});
