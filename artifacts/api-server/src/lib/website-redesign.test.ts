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

async function page(path: string, options: { route?: string; seeds?: Array<[unknown[], unknown]> } = {}) {
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
          contents: "export const useAuth=()=>({user:null,token:null,isAuthenticated:false,isLoading:false,login:async()=>{throw new Error('Not called during rendering')}});",
        }));
      },
    }],
  });
  const mod = { exports: {} as { default: any } };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(webRequire, mod, mod.exports);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const [key, data] of options.seeds ?? []) client.setQueryData(key, data);
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { search: "", hash: "" } } });
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(Router, { hook: () => [options.route ?? "/", () => {}] }, createElement(mod.exports.default))));
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

test("redesigned feed keeps honest live-feed modes instead of promising unavailable ranking", async () => {
  const html = await page("src/pages/feed.tsx");
  assert.match(html, /Following/);
  assert.match(html, /All posts/);
  assert.doesNotMatch(html, /based on (?:the causes|your giving)|14 hands|12,485|12,260/);
});

test("redesigned About retains original founder assets without unverified Gift Aid promises", async () => {
  const html = await page("src/pages/about.tsx");
  assert.match(html, /visaka\.jpeg/);
  assert.match(html, /ayotemi\.jpeg/);
  assert.match(html, /Hurricane Melissa/);
  assert.match(html, /href="\/register"/);
  assert.match(html, /href="\/discover"/);
  assert.doesNotMatch(html, /Gift Aid|in full alignment with UK fundraising regulation/);
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
  assert.match(html, /rp-orgp rp-page-shell/);
  assert.match(html, /data-testid="text-org-name">Profile Regression Organisation/);
  assert.match(html, /A library for everyone\./);
  assert.match(html, /src="\/test-logo\.png"/);
  assert.match(html, /src="\/test-cover\.png"/);
  assert.match(html, /data-testid="card-content-profile-test-post"/);
  assert.match(html, /Opening the library/);
  for (const tab of ["Posts", "Campaigns", "Volunteer", "About"]) assert.ok(html.includes(tab), `missing ${tab}`);
  assert.match(html, /href="\/campaign\/library\/books"/);
  assert.match(html, /Donate to this campaign/);
  assert.match(html, /data-testid="button-donate-org"/);
  assert.doesNotMatch(html, /totalOwedGbp|bank.details|payout reference/i);
});

test("public-page sizing keeps the wide feed, readable captions and model-sized sign-in form", async () => {
  const html = await page("src/pages/feed.tsx");
  assert.match(html, /rps-feed/);
  assert.match(html, /max-w-\[860px\]/);
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
