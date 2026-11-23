import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

// Render the real routed pages, not the HTML models. No Firebase, email,
// payment or payout requests are made by these presentation regressions.
const webRoot = new URL("../../../web/", import.meta.url);
const webRequire = createRequire(new URL("package.json", webRoot));
const { createElement } = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const { Router } = webRequire("wouter");
const { QueryClient, QueryClientProvider } = webRequire("@tanstack/react-query");

async function page(path: string, options: { route?: string; search?: string; signedIn?: boolean; seeds?: Array<[unknown[], unknown]> } = {}) {
  const result = await build({
    entryPoints: [new URL(path, webRoot).pathname],
    bundle: true, write: false, format: "cjs", platform: "node",
    packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    alias: { "@": new URL("src/", webRoot).pathname },
    define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
    plugins: [{
      name: "isolated-auth",
      setup(b) {
        b.onResolve({ filter: /^@workspace\/api-client-react$/ }, () => ({
          path: new URL("../../../../lib/api-client-react/src/generated/api.ts", import.meta.url).pathname,
        }));
        b.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: "auth", namespace: "isolated" }));
        b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({
          contents: `export const useAuth=()=>({user:${options.signedIn ? '{id:"fixture",name:"Fixture Supporter",accountType:"supporter"}' : "null"},token:${options.signedIn ? '"fixture-token"' : "null"},isAuthenticated:${!!options.signedIn},isLoading:false,login:async()=>{throw new Error('Not called during rendering')}});`,
        }));
      },
    }],
  });
  const mod = { exports: {} as { default: any } };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(webRequire, mod, mod.exports);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const [key, data] of options.seeds ?? []) client.setQueryData(key, data);
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { search: options.search ?? "", hash: "" } } });
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(Router, { hook: () => [options.route ?? "/", () => {}], searchHook: () => options.search ?? "" }, createElement(mod.exports.default))));
  } finally {
    client.clear();
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("redesigned welcome uses real supporter, organisation and feed destinations", async () => {
  const html = await page("src/pages/landing.tsx");
  for (const destination of ["/feed", "/register", "/onboarding", "/login"]) {
    assert.ok(html.includes(`href="${destination}"`), `missing ${destination} destination`);
  }
  assert.match(html, /Restoration/);
  assert.match(html, /Culture/);
  assert.match(html, /Access/);
  assert.doesNotMatch(html, /href="#"/);
});

test("redesigned sign-in retains credential fields and recovery without demo authentication", async () => {
  const html = await page("src/pages/login.tsx");
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="current-password"/);
  assert.match(html, /href="\/forgot-password"/);
  assert.match(html, /href="\/register"/);
  assert.match(html, /(?:Show|show|Toggle|toggle) password/);
  assert.doesNotMatch(html, /onsubmit="return false"|href="#"/);
});

test("signed-out feed shows the public organisation feed without supporter modes", async () => {
  const html = await page("src/pages/feed.tsx");
  assert.match(html, /data-testid="page-guest-feed"/);
  assert.match(html, /Live from the ground/);
  assert.match(html, /Real updates from grassroots organisations on Root ProjX, newest first/);
  assert.doesNotMatch(html, /All posts|role="tab"|Follow organisations to see their work here/);
  assert.doesNotMatch(html, /based on (?:the causes|your giving)|14 hands|12,485|12,260/);
});

test("signed-in About retains original founder assets without unverified Gift Aid promises", async () => {
  const html = await page("src/pages/about.tsx", { signedIn: true });
  assert.match(html, /visaka\.jpeg/);
  assert.match(html, /ayotemi\.jpeg/);
  assert.match(html, /Hurricane Melissa/);
  assert.match(html, /href="\/register"/);
  assert.match(html, /href="\/discover"/);
  assert.doesNotMatch(html, /Gift Aid|in full alignment with UK fundraising regulation/);
});

test("visitor About and Shop match the shared heading and retain real signup destinations", async () => {
  const about = await page("src/pages/about.tsx");
  assert.match(about, /About Root ProjX/);
  assert.match(about, /Follow/);
  assert.match(about, /See it happen/);
  assert.match(about, /Give/);
  assert.match(about, /text-\[48px\] md:text-\[88px\]/);
  assert.match(about, /href="\/register"/);
  assert.match(about, /href="\/onboarding"/);
  assert.doesNotMatch(about, /visaka\.jpeg|ayotemi\.jpeg/);
  const shop = await page("src/pages/shop.tsx");
  assert.match(shop, /Merch is coming\. Tees, totes and prints/);
  assert.match(shop, /Notify me/);
  assert.match(shop, /type="email"/);
  assert.doesNotMatch(shop, /ShoppingBag|rounded-full/);
  const signedInShop = await page("src/pages/shop.tsx", { signedIn: true });
  assert.match(signedInShop, /Coming soon/);
  assert.doesNotMatch(signedInShop, /Notify me/);
});

test("website loads the supplied typography and preserves accessible viewport zoom", async () => {
  const html = await readFile(new URL("index.html", webRoot), "utf8");
  for (const font of ["Archivo", "Familjen", "JetBrains"]) assert.ok(html.includes(font), `missing ${font}`);
  assert.doesNotMatch(html, /maximum-scale=1|user-scalable=no/);
});

test("public organisation profile uses the redesign with real data and preserves its public features", async () => {
  const id = "profile-regression-org";
  const html = await page("src/pages/org-profile.tsx", {
    route: `/organisations/${id}`,
    seeds: [
      [["org", id], {
        _id: id, name: "Profile Regression Organisation", category: "Education", country: "Jamaica",
        verified: true, description: "Local people building a library.", shortDescription: "A library for everyone.",
        logo: "/test-logo.png", coverImage: "/test-cover.png", followerCount: 42, totalRaised: 125,
      }],
      [["org-feed", id], [{
        _id: "profile-test-post", orgId: id, orgName: "Profile Regression Organisation",
        title: "Opening the library", content: "The first shelves are ready.",
        createdAt: "2026-11-01T12:00:00Z", imageUrls: ["/library-photo.png"], videoUrls: [],
      }]],
      [["campaigns", id], [{
        _id: "library-campaign", publicId: "cp_library", sharePath: "/campaign/library/books",
        name: "Books for everyone", description: "Help fill the shelves.", type: "fundraising",
        goal: 1000, amountRaised: 125, currency: "gbp", status: "active", enabled: true,
      }]],
      [["volunteerRoles", id], []], [["org-reviews", id], []], [["org-supporters", id], []],
    ],
  });
  assert.match(html, /class="rp-orgp"/);
  assert.match(html, /data-testid="text-org-name">Profile Regression Organisation/);
  assert.match(html, /A library for everyone\./);
  assert.match(html, /src="\/test-logo\.png"/);
  assert.doesNotMatch(html, /src="\/test-cover\.png"|orgp-cover/);
  assert.match(html, /data-testid="card-content-profile-test-post"/);
  assert.match(html, /Opening the library/);
  assert.match(html, /data-testid="tab-posts"/);
  assert.match(html, /data-testid="tab-campaigns"/);
  assert.doesNotMatch(html, /data-testid="tab-(volunteer|about|archived)"/);
  assert.match(html, /href="\/campaign\/library\/books"/);
  assert.match(html, /data-testid="card-live-campaign"/);
  assert.match(html, /data-testid="stat-campaigns"/);
  assert.match(html, /data-testid="button-share-org"/);
  assert.doesNotMatch(html, /bar-donor-preview/);
  assert.match(html, /data-testid="button-donate-org"/);
  assert.doesNotMatch(html, /totalOwedGbp|bank.details|payout reference/i);
});

test("donor preview uses the same public profile and adds only its preview notice", async () => {
  const id = "donor-preview-fixture";
  const seeds: Array<[unknown[], unknown]> = [
    [["org", id], { _id: id, name: "Donor Preview Organisation", country: "Jamaica", category: "Education", totalRaised: 0, followerCount: 0 }],
    [["org-feed", id], []], [["campaigns", id], []],
  ];
  const options = { route: `/organisations/${id}`, seeds };
  const normal = await page("src/pages/org-profile.tsx", options);
  const preview = await page("src/pages/org-profile.tsx", { ...options, search: "?preview=1" });
  assert.match(preview, /You&#x27;re previewing your page as a donor/);
  assert.match(preview, /data-testid="link-back-dashboard" href="\/dashboard"/);
  assert.equal(preview.replace(/<div class="orgp-preview"[\s\S]*?<\/div>/, ""), normal);
  assert.match(preview, /data-testid="stat-raised"/);
  assert.doesNotMatch(preview, /Owed to you|Archived posts|supporters.list|Edit profile|Create post/);
});

test("public-page sizing keeps the wide feed, readable captions and model-sized sign-in form", async () => {
  const html = await page("src/pages/feed.tsx");
  assert.match(html, /page-guest-feed/);
  assert.match(html, /max-w-\[1240px\]/);
  assert.doesNotMatch(html, /max-w-\[560px\]/);
  const feed = await readFile(new URL("src/pages/feed.tsx", webRoot), "utf8");
  assert.match(feed, /text-\[18px\] leading-relaxed/);
  const login = await page("src/pages/login.tsx");
  assert.match(login, /max-w-\[460px\]/);
  const css = await readFile(new URL("src/index.css", webRoot), "utf8");
  assert.match(css, /\.rp-page-shell\s*\{[^}]*max-width: 1440px/s);
  const supporterCss = await readFile(new URL("src/components/supporter/supporter.css", webRoot), "utf8");
  assert.match(supporterCss, /\.rps-main\s*\{[^}]*max-width:\s*860px/s);
  assert.doesNotMatch(css, /\bzoom\s*:/); // Resize the layout, never override the visitor's browser zoom.
});
