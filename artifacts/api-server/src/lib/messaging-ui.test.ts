import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

test("messaging UI: desktop and phone badges share private counts and hide when read or signed out", async () => {
  const webRoot = new URL("../../../web/", import.meta.url);
  const require = createRequire(new URL("package.json", webRoot));
  const { createElement: h } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
  const bundle = await build({
    stdin: {
      contents: `export {InboxBadge} from "./components/inbox/InboxBadge.tsx";export {auth} from "inbox-auth";`,
      resolveDir: new URL("src/", webRoot).pathname,
    },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    alias: { "@": new URL("src/", webRoot).pathname },
    plugins: [{
      name: "private-messaging-render",
      setup(b) {
        b.onResolve({ filter: /context\/AuthContext$|^inbox-auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const auth={token:"fixture-token",user:{id:"fixture-user"}};export const useAuth=()=>auth;`,
        }));
        b.onResolve({ filter: /^@workspace\/api-client-react$/ }, () => ({ path: "api", namespace: "no-network" }));
        b.onLoad({ filter: /.*/, namespace: "no-network" }, () => ({
          contents: `const forbidden=()=>{throw Error("Rendering must not send requests")};export {
            forbidden as getMessagingContext,forbidden as listMessageConversations,
            forbidden as getConversationMessages,forbidden as getMessagingTeam};`,
        }));
      },
    }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(require, mod, mod.exports);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ids = ["badge-inbox-sidebar", "badge-inbox-mobile", "badge-inbox-tab"];
  const render = () => renderToStaticMarkup(h(QueryClientProvider, { client },
    h("div", null, ...ids.map(testId => h(mod.exports.InboxBadge, { key: testId, testId })))));
  const seed = (unreadCount: number) => client.setQueryData(["messaging", "fixture-token", "context"], {
    personal: true, personalUnreadCount: unreadCount, organisations: [], unreadCount,
  });
  try {
    seed(2);
    const unread = render();
    for (const id of ids) assert.match(unread, new RegExp(`data-testid="${id}"[^>]*aria-label="2 unread messages"[^>]*>2<`));
    seed(0);
    assert.equal(render(), "<div></div>");
    seed(2);
    mod.exports.auth.token = null; mod.exports.auth.user = null;
    assert.equal(render(), "<div></div>", "the previous account's cached count must not be displayed");
  } finally { client.clear(); }
});
