import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

// Exercise the actual /register component with hook/auth boundaries replaced.
// These tests never contact Firebase or create a real supporter account.
const webRoot = new URL("../../../web/", import.meta.url);
const webRequire = createRequire(new URL("package.json", webRoot));
let compiled: Promise<string> | undefined;

type Fields = { name?: string; email?: string; phone?: string; password?: string };

async function registration(fields: Fields = {}, search = "", refuse = false) {
  compiled ??= build({
    entryPoints: [new URL("src/pages/register.tsx", webRoot).pathname],
    bundle: true, write: false, format: "cjs", platform: "node",
    packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    alias: { "@": new URL("src/", webRoot).pathname },
    plugins: [{
      name: "registration-auth-boundary",
      setup(b) {
        b.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: "registration-auth", external: true }));
      },
    }],
  }).then(result => result.outputFiles[0]!.text);
  const calls: unknown[] = [];
  const navigations: string[] = [];
  const updates: Array<{ slot: number; value: unknown }> = [];
  const values = [undefined, undefined, fields.name ?? "", fields.email, fields.phone ?? "", fields.password ?? ""];
  let hook = 0;
  const react = {
    ...webRequire("react"),
    useState(initial: unknown) {
      const slot = hook++;
      const value = slot < 2 || (slot === 3 && fields.email === undefined) ? initial : values[slot];
      return [value, (next: unknown) => updates.push({ slot, value: next })];
    },
  };
  const auth = {
    useAuth: () => ({
      register: async (payload: unknown) => {
        calls.push(payload);
        if (refuse) throw new Error("Registration is unavailable.");
      },
    }),
  };
  const requireMock = (name: string) => {
    if (name === "react") return react;
    if (name === "registration-auth") return auth;
    if (name === "wouter") return {
      Link: "a",
      useLocation: () => ["/register", (path: string) => navigations.push(path)],
      useSearch: () => search,
    };
    return webRequire(name);
  };
  const mod = { exports: {} as { default: () => any } };
  const storage = new Map<string, string>();
  new Function("require", "module", "exports", "sessionStorage", await compiled)(
    requireMock, mod, mod.exports, {
      setItem(key: string, value: string) { storage.set(key, value); },
      removeItem(key: string) { storage.delete(key); },
    },
  );
  const tree = mod.exports.default();
  function find(node: any, predicate: (node: any) => boolean): any {
    if (!node || typeof node !== "object") return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return undefined;
  }
  const form = find(tree, node => node.type === "form");
  assert.ok(form, "actual registration form must remain");
  function text(node: any): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(text).join(" ");
    return node?.props ? text(node.props.children) : "";
  }
  return {
    calls, navigations, updates, storage,
    text: text(tree),
    field: (id: string) => find(tree, node => node.props?.["data-testid"] === id)?.props,
    submit: () => form.props.onSubmit({ preventDefault() {} }),
  };
}

test("register redesign retains four fields, native input types, optional phone and working links", async () => {
  const form = await registration({}, "email=prefilled%40example.org");
  for (const name of ["name", "email", "phone", "password"]) assert.ok(form.field(`input-${name}`), `missing ${name}`);
  assert.equal(form.field("input-email").value, "prefilled@example.org");
  assert.equal(form.field("input-email").type, "email");
  assert.equal(form.field("input-phone").type, "tel");
  assert.equal(form.field("input-phone").required, undefined);
  assert.equal(form.field("input-password").type, "password");
  assert.equal(form.field("input-password").autoComplete, "new-password");
  assert.equal(form.field("input-password").minLength, undefined);
  assert.equal(form.field("link-login").href, "/login");
  assert.equal(form.field("link-onboarding").href, "/onboarding");
  assert.equal(form.field("button-submit-register").type, "submit");
});

test("register uses the supplied supporter copy without removing the optional phone field", async () => {
  const form = await registration();
  assert.match(form.text, /JOIN THE MOVEMENT/);
  assert.match(form.text, /CONNECTING DIASPORA WITH GRASSROOTS CHANGE\./);
  assert.match(form.text, /Become a supporter\. Follow grassroots organisations, read their updates and see your impact in real time\./);
  assert.match(form.text, /PHONE\s+\(OPTIONAL\)/);
  assert.match(form.text, /Already have an account\?/);
  assert.match(form.text, /Apply to join/);
});

test("register keeps existing required-field and six-character password validation", async () => {
  const empty = await registration();
  await empty.submit();
  assert.deepEqual(empty.calls, []);
  assert.ok(empty.updates.some(update => update.value === "Name, email and password are required."));
  const short = await registration({ name: "Test Supporter", email: "supporter@example.org", password: "12345" });
  await short.submit();
  assert.deepEqual(short.calls, []);
  assert.ok(short.updates.some(update => update.value === "Password must be at least 6 characters."));
});

test("register preserves supporter payload and sends new accounts to optional Interests", async () => {
  const fields = { name: " Test Supporter ", email: " SUPPORTER@EXAMPLE.ORG ", password: "123456" };
  const withoutPhone = await registration(fields);
  await withoutPhone.submit();
  assert.deepEqual(withoutPhone.calls, [{
    name: "Test Supporter", email: "supporter@example.org", password: "123456", phone: undefined, accountType: "supporter",
  }]);
  assert.deepEqual(withoutPhone.navigations, ["/onboarding/interests"]);
  assert.equal(withoutPhone.storage.get("rp_onboarding_interests"), "1");
  const withPhone = await registration({ ...fields, phone: " +440000000000 " }, "next=%2Fdiscover");
  await withPhone.submit();
  assert.equal((withPhone.calls[0] as { phone: string }).phone, "+440000000000");
  assert.deepEqual(withPhone.navigations, ["/onboarding/interests"]);
});

test("register failure leaves the form available and never redirects", async () => {
  const form = await registration({ name: "Test Supporter", email: "supporter@example.org", password: "123456" }, "", true);
  await form.submit();
  assert.equal(form.calls.length, 1);
  assert.deepEqual(form.navigations, []);
  assert.ok(form.updates.some(update => update.slot === 1 && typeof update.value === "string" && update.value.length > 0));
  assert.deepEqual(form.updates.filter(update => update.slot === 0).map(update => update.value), [true, false]);
});
