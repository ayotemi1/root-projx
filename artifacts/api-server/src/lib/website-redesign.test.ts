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

async function page(path: string) {
  const result = await build({
    entryPoints: [new URL(path, webRoot).pathname],
    bundle: true, write: false, format: "cjs", platform: "node",
    packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    alias: { "@": new URL("src/", webRoot).pathname },
    define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
    plugins: [{
      name: "isolated-auth",
      setup(b) {
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
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(Router, { hook: () => ["/", () => {}] }, createElement(mod.exports.default))));
  } finally { client.clear(); }
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
