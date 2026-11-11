import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

test("Discover cards use saved organisation logos and retain initials for missing images", async () => {
  const webRequire = createRequire(new URL("../../../web/package.json", import.meta.url));
  const React = webRequire("react");
  const { renderToStaticMarkup } = webRequire("react-dom/server");
  const file = new URL("../../../web/src/components/organisation-logo.tsx", import.meta.url);
  const result = await build({
    entryPoints: [file.pathname], bundle: true, write: false, format: "cjs",
    platform: "node", packages: "external", jsx: "automatic",
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(webRequire, module, module.exports);
  const render = (logo: string | null) => renderToStaticMarkup(
    React.createElement(module.exports.OrganisationLogo, { name: "Humanity Ova Vanity", logo }),
  );
  const markup = render("/api/uploads/object/hov-logo.png");
  assert.match(markup, /src="\/api\/uploads\/object\/hov-logo.png"/);
  assert.match(markup, /alt="Humanity Ova Vanity logo"/);
  assert.doesNotMatch(markup, />HO</);
  for (const missing of [null, "", "  "]) {
    assert.doesNotMatch(render(missing), /<img/);
    assert.match(render(missing), />HO</);
  }
  const component = await readFile(file, "utf8");
  assert.match(component, /onError=\{\(\) => setFailedLogo\(src\)\}/);
  assert.match(component, /failedLogo !== src/);
  const discover = await readFile(new URL("../../../web/src/pages/discover.tsx", import.meta.url), "utf8");
  assert.match(discover, /<OrganisationLogo name=\{org.name\} logo=\{org.logo\}/);
});
