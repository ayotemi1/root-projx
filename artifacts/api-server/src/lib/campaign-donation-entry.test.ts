import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";

// Bundle the real web controls with the web React instance. No network calls or
// charges: click wiring, recipient text and checkout payload are tested locally.
const webRoot = new URL("../../../web/", import.meta.url);
const webRequire = createRequire(new URL("package.json", webRoot));
const { createElement } = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const { Router } = webRequire("wouter");
const renderSheet = (Sheet: any, props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(Router, {hook: () => ["/", () => {}]},
    createElement(Sheet, {open: true, onClose() {}, orgId: "org-1", orgName: "Community Trust", ...props})));

async function loadComponent(path: string) {
  const result = await build({
    entryPoints: [new URL(path, webRoot).pathname],
    bundle: true, write: false, format: "cjs", platform: "node",
    packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    alias: { "@": new URL("src/", webRoot).pathname },
    plugins: [{ name: "signed-out-bookmarks", setup(b) {
      b.onResolve({ filter: /bookmarks\/BookmarkButton/ }, () => ({ path: "guest", namespace: "bookmark" }));
      b.onLoad({ filter: /.*/, namespace: "bookmark" }, () => ({ contents: "export const BookmarkButton=()=>null;" }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(webRequire, mod, mod.exports);
  return mod.exports;
}

test("Out of Many Hands uses the exact original currentColor handprint asset everywhere", async () => {
  const asset = await readFile(new URL("public/campaign-units/handprint.svg", webRoot), "utf8");
  assert.match(asset, /viewBox="0 0 240 240"/);
  assert.match(asset, /id="handprint"/);
  assert.match(asset, /fill="currentColor"/);
  assert.doesNotMatch(asset, /#[0-9a-f]{3,8}\b/i);
  const path = asset.match(/\bd="([^"]+)"/)?.[1];
  assert.ok(path);
  assert.equal(createHash("sha256").update(path).digest("hex"), "e2eb9693aa314344a461fa70d9f8530314a6c0597bad7dd9fbcee5c4b928d2eb");
  await assert.rejects(access(new URL("public/campaign-units/hand.svg", webRoot)));
  const { CampaignSymbol } = await loadComponent("src/components/campaign-symbol.tsx");
  const hand = renderToStaticMarkup(createElement(CampaignSymbol, { campaign: { name: "Out of Many Hands" } }));
  assert.match(hand, /handprint.svg#handprint/);
  assert.match(hand, /color:#B3121B/);
  for (const name of ["Drum Life", "Other campaign"]) {
    const html = renderToStaticMarkup(createElement(CampaignSymbol, { campaign: { name } }));
    assert.doesNotMatch(html, /handprint/);
  }
  const wall = await readFile(new URL("src/components/campaign/accumulation-field.tsx", webRoot), "utf8");
  assert.match(wall, /globalCompositeOperation = "source-in"/);
  assert.match(wall, /marker-ghost-hand/);
  assert.match(wall, /<DonationHand/);
  const page = await readFile(new URL("src/components/campaign/campaign-page-view.tsx", webRoot), "utf8");
  assert.match(page, /imageUrl=\{HANDPRINT_URL\}/);
  assert.match(page, /colour="#17100F"/);
  assert.match(page, /accent="#B3121B"/);
  assert.match(page, /highlightNewest=\{highlightNewest \|\| !!confirmedReceipt\}/);
  assert.doesNotMatch(page, /unit\?\.imageUrl|unitImageUrl/);
});

test("outcomes show only their saved titles and descriptions in public and preview, without stat numbers or footnotes", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const campaign = { _id: "outcomes-check", name: "Real campaign", type: "fundraising",
    goal: 1200, amountRaised: 75, supporterCount: 2, description: "", enabled: true,
    phases: [{ id: "one", title: "Participants in training", description: "Real training places", completed: false }],
    pageContent: { outcomesNote: "These are intended outcomes, not results already achieved." } };
  for (const preview of [false, true]) {
    const html = renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
      createElement(CampaignPageView, { campaign, organisation: { _id: "org-check", name: "Real organisation" }, preview })));
    const outcomes = html.match(/<ol[^>]*data-testid="list-campaign-milestones"[\s\S]*?<\/ol>/)?.[0] ?? "";
    assert.match(outcomes, /Participants in training/);
    assert.match(outcomes, /Real training places/);
    assert.doesNotMatch(outcomes, /rc-v|rc-state|TBC|To come|Completed/);
    assert.doesNotMatch(html, /These are intended outcomes|text-outcomes-note/);
    assert.match(html, /text-campaign-progress/);
  }
});

test("Programme and Outcomes grids use their actual item count for every reference layout", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  for (let count = 1; count <= 6; count++) {
    const campaign = { _id: "grid-check", name: "Grid check", type: "fundraising", description: "Real saved story",
      breakdown: Array.from({ length: count }, (_, i) => ({ label: `Trade ${i}`, detail: "Saved detail" })),
      phases: Array.from({ length: count }, (_, i) => ({ id: `p${i}`, title: `Outcome ${i}`, description: "Saved line" })) };
    const html = renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
      createElement(CampaignPageView, { campaign, organisation: { _id: "grid-org", name: "Grid organisation" }, preview: true })));
    assert.equal((html.match(new RegExp(`class="[^"]*rc-boxes[^"]*" data-n="${count}"`, "g")) ?? []).length, 2);
  }
  const css = await readFile(new URL("src/components/campaign/campaign-redesign.css", webRoot), "utf8");
  assert.match(css, /repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /rc-boxes\[data-n="5"\]\s*>\s*:nth-child\(n\+4\)/);
  assert.match(css, /@container rc \(max-width: 699\.98px\)/);
});

test("the shared page reads Story overrides in public and preview without changing legacy records or donation totals", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const campaign = { _id: "story-overrides", name: "Story check", type: "fundraising", enabled: true,
    goal: 1200, amountRaised: 75, supporterCount: 2, description: "Legacy first paragraph\n\nKeep this second paragraph.",
    breakdown: [{ label: "Legacy trade", detail: "Old trade description" }],
    phases: [{ id: "legacy", title: "Legacy outcome", description: "Old outcome description", targetAmount: 800, completed: true }],
    pageDesign: {
      need: { headline: "Actual need", intro: "New first paragraph." },
      programme: { headline: "Actual programme", intro: "Real programme intro.",
        boxes: [{ id: "p1", title: "Build", text: "Learn building." }, { id: "p2", title: "Sew", text: "Learn sewing." }] },
      outcomes: { headline: "Actual outcomes", intro: "Real outcome intro.",
        boxes: ["Skills", "Trade", "Childcare"].map((title, i) => ({ id: `o${i}`, title, text: "Real outcome text." })) },
      team: { headline: "Actual team", intro: "Real people.", people: [{ id: "person", name: "Campaign coordinator", role: "Lead" }] },
    } };
  const before = JSON.stringify(campaign);
  for (const preview of [false, true]) {
    const html = renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
      createElement(CampaignPageView, { campaign, organisation: { _id: "story-org", name: "Organisation", team: [{ name: "Original teammate" }] }, preview })));
    for (const text of ["Actual need", "New first paragraph.", "Keep this second paragraph.", "Actual programme", "Learn sewing.", "Actual outcomes", "Campaign coordinator"]) {
      assert.ok(html.includes(text), `${text} was not rendered`);
    }
    assert.doesNotMatch(html, /Legacy first paragraph|Legacy trade|Legacy outcome|Original teammate/);
    assert.match(html, /£75/);
    assert.match(html, /rc-boxes[^>]*data-n="2"/);
    assert.match(html, /rc-boxes[^>]*data-n="3"/);
    assert.equal(JSON.stringify(campaign), before);
  }
});

test("Look reorders real sections and numbers in public and preview, scopes all five schemes and fixes the opening and close", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const order = ["wall", "money", "team", "outcomes", "programme", "need"];
  const campaign = { _id: "look-order", name: "Out of Many Hands", type: "fundraising", enabled: true,
    description: "Actual story", goal: 1000, amountRaised: 25, supporterCount: 1,
    breakdown: [{ label: "First trade", detail: "Actual detail" }, { label: "Second trade", detail: "Actual detail" }],
    phases: [{ id: "p", title: "Outcome", description: "Actual result" }], pageDesign: { order, schemes: {} } };
  const render = (preview: boolean) => renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignPageView, { campaign, organisation: { _id: "look-org", name: "Organisation" }, preview })));
  for (const preview of [false, true]) {
    const html = render(preview);
    assert.deepEqual([...html.matchAll(/data-section="([^"]+)"/g)].map(m => m[1]), order);
    assert.deepEqual([...html.matchAll(/class="rc-num">(\d+)</g)].map(m => Number(m[1])), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.ok(html.indexOf('data-testid="text-campaign-progress"') < html.indexOf('data-section="wall"'));
    assert.ok(html.indexOf('data-testid="block-share"') > html.indexOf('data-section="need"'));
    assert.match(html, /class="rc-hero rc-on-dark" data-testid="block-share"/);
    assert.match(html, /£25/);
  }
  for (const [scheme, token] of [["cream", "rc-t-cream"], ["white", "rc-t-paper"], ["red", "rc-s-red"], ["ink", "rc-on-dark"], ["yellow", "rc-on-hi"]]) {
    campaign.pageDesign.schemes = { programme: scheme };
    assert.match(render(true), new RegExp(`<section class="[^"]*${token}[^"]*" data-section="programme"`));
  }
  campaign.pageDesign.order = ["need", "need", "outcomes", "team", "money", "wall"];
  assert.deepEqual([...render(true).matchAll(/data-section="([^"]+)"/g)].map(m => m[1]), ["need", "programme", "outcomes", "team", "money", "wall"]);
});

test("Story accepts 1–9 boxes and its layout diagram fills every row", async () => {
  const { PD, layoutSpans, layoutWords, pageDesignProblem } = await loadComponent("src/components/campaign-builder/story-design.ts");
  const expected = [[6], [3, 3], [2, 2, 2], [3, 3, 3, 3], [2, 2, 2, 3, 3],
    [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 6], [2, 2, 2, 2, 2, 2, 3, 3], Array(9).fill(2)];
  for (const section of ["programme", "outcomes"]) {
    assert.equal(PD[section].min, 1);
    assert.equal(PD[section].max, 9);
    for (let n = 1; n <= 9; n++) {
      const boxes = Array.from({ length: n }, (_, i) => ({ id: `box-${i}`, title: "Title", text: "Text" }));
      assert.equal(pageDesignProblem({ [section]: { headline: "", intro: "", boxes } }), null);
      assert.deepEqual(layoutSpans(n), expected[n - 1]);
    }
    assert.equal(pageDesignProblem({ [section]: { boxes: Array(10).fill({ title: "", text: "" }) } }), "9 is the most for this section.");
    assert.match(pageDesignProblem({ [section]: { boxes: [] } }), /at least 1 box/);
  }
  assert.deepEqual(PD.team, { min: 1, max: 8, name: 40, role: 50 });
  assert.equal(layoutWords(6), "2 rows of 3");
});

test("new blank draft boxes still determine the real preview grid without fabricated text", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const boxes = [0, 1].map(i => ({ id: `box-${i}`, title: "", text: "" }));
  const campaign = { _id: "blank-grid", name: "Blank grid", type: "fundraising", pageDesign: {
    programme: { headline: "Programme", intro: "", boxes },
    team: { headline: "Team", intro: "", people: [{ id: "p", name: "", role: "" }] },
  } };
  const html = renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignPageView, { campaign, organisation: { _id: "org", name: "Organisation" }, preview: true })));
  assert.match(html, /rc-boxes[^>]*data-n="2"/);
  assert.match(html, /data-testid="card-team-0"/);
  assert.doesNotMatch(html, /Your campaign name|Your story will appear|Box title/);
});

test("fitted words leave rounding space at both actual and scaled preview widths", async () => {
  const { availableTextWidth } = await loadComponent("src/components/campaign/fit-metrics.ts");
  for (const scale of [1, 0.9, 0.65, 0.4, 0.23]) {
    const width = 354 * scale;
    const el = { offsetWidth: 354, clientWidth: 354, getBoundingClientRect: () => ({ width }) };
    const safeWidth = availableTextWidth(el);
    assert.ok(safeWidth <= width - 1, "Allow at least a screen pixel for rounding");
    assert.ok(safeWidth < width + 0.5, "The former overflowing candidate must not fit");
  }
  const css = await readFile(new URL("src/components/campaign/campaign-redesign.css", webRoot), "utf8");
  assert.match(css, /rc-hero-copy \.rc-h1 span,[\s\S]*?overflow-wrap: normal; word-break: normal; hyphens: none;/);
});

test("Drum Life renders 50 drums from money and never falls back to a hand wall", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const { DRUM_SPOTS, fundedDrums } = await loadComponent("src/lib/drum-experience.ts");
  assert.equal(DRUM_SPOTS.length, 50);
  assert.equal(DRUM_SPOTS.filter((s: any) => s.ring === 0).length, 1);
  assert.equal(new Set(DRUM_SPOTS.map((s: any) => s.n)).size, 50);
  for (const [amount, expected] of [[0, 0], [149.99, 0], [150, 1], [300, 2], [7500, 50], [15000, 50], [Infinity, 0]]) {
    assert.equal(fundedDrums(amount), expected);
  }
  const campaign = { _id: "9d5e9d29323a434f8706", name: "Drum Life", type: "fundraising", currency: "usd",
    goal: 15000, amountRaised: 300, supporterCount: 99, description: "", phases: [], status: "active",
    enabled: true, drumExperience: { enabled: true, updates: [] } };
  const organisation = { _id: "LTMwjXVEgxNideK0XtIQudxZXjc2", name: "Lifeyard", country: "Jamaica" };
  const render = (changes: any, preview: boolean) => renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignPageView, { campaign: { ...campaign, ...changes }, organisation, preview, layout: "phone" })));
  for (const preview of [false, true]) {
    const html = render({}, preview);
    assert.match(html, /block-drum-circle/);
    assert.equal((html.match(/data-testid="button-drum-\d+"/g) ?? []).length, 50);
    assert.match(html, /Drum build: 2 of 50 drums funded/);
    assert.match(html, /Drum 1, the reclaimed-wood centre drum, funded/);
    assert.match(html, /Drum 3, waiting for funding/);
    assert.match(html, /fill="var\(--rc-accent\)"/);
    assert.equal((html.match(/aria-pressed="true"(?=[^>]*data-testid="button-drum-\d+")/g) ?? []).length, 1);
    assert.match(html, /Humanity Ova Vanity/);
    assert.doesNotMatch(html, /99 supporters|data-testid="text-supporter-count"|marker-your-hand/);
    assert.match(html, /select-drum/);
    assert.match(html, /block-campaign-donate-box|Support this campaign/);
    const zero = render({ amountRaised: 0 }, preview);
    assert.match(zero, /Drum build: 0 of 50 drums funded/);
    assert.match(zero, /Drum 1, the reclaimed-wood centre drum, waiting for funding/);
    for (const changes of [{ drumExperience: null }, { drumExperience: { enabled: false, updates: [] } }, { currency: "gbp" }]) {
      const ordinary = render(changes, preview);
      assert.doesNotMatch(ordinary, /block-drum-circle/);
      assert.doesNotMatch(ordinary, /canvas-accumulation|marker-your-hand|Latest hands/);
      assert.match(ordinary, /lucide-drum/);
    }
  }
});

test("Drum Life builder is invisible to HOV and other campaigns, including USD campaigns", async () => {
  const { StepLook } = await loadComponent("src/components/campaign-builder/steps.tsx");
  const { draftFromCampaign } = await loadComponent("src/components/campaign-builder/model.ts");
  const d = draftFromCampaign({ _id: "other", name: "Out of Many Hands", currency: "usd", type: "fundraising" });
  const render = (orgId: string, campaignId: string) => renderToStaticMarkup(createElement(StepLook, {
    d, orgId, campaignId, update() {}, token: "synthetic", assistEnabled: false,
  }));
  for (const [org, campaign] of [["hov", "other"], ["hov", "9d5e9d29323a434f8706"], ["LTMwjXVEgxNideK0XtIQudxZXjc2", "other"]]) {
    assert.doesNotMatch(render(org!, campaign!), /button-appearance-drum|US\$150|Drum build/);
  }
  assert.match(render("LTMwjXVEgxNideK0XtIQudxZXjc2", "9d5e9d29323a434f8706"), /button-appearance-drum/);
});

test("Lifeyard's split Story and purpose-led budget preserve saved copy without changing other campaigns", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const campaign = { _id: "9d5e9d29323a434f8706", name: "Drum Life", type: "fundraising", currency: "usd",
    goal: 18000, amountRaised: 0, supporterCount: 0, status: "active", enabled: false,
    description: "Our saved opening paragraph.\n\nOur saved second paragraph.",
    drumExperience: { enabled: true, updates: [] },
    breakdown: [
      { label: "$7500", detail: "50 drums for hands-on learning, practice and performance." },
      { label: "$650", detail: "Three months of drumming tuition with master drummer Moustafa Reds." },
      { label: "Locally donated space", detail: "Keep this custom row exactly as written." },
      { detail: "A description-only item should not leave a vacant cost column." },
    ],
    pageContent: { programmeIntro: "Our saved intro explains a funding gap, without hiding anything." },
  };
  const organisation = { _id: "LTMwjXVEgxNideK0XtIQudxZXjc2", name: "Lifeyard", country: "Jamaica" };
  const render = (c: any, org: any, layout = "phone") => renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignPageView, { campaign: c, organisation: org, preview: true, layout })));
  for (const layout of ["phone", "desktop", "responsive"]) {
    const html = render(campaign, organisation, layout);
    assert.match(html, /data-testid="block-lifeyard-story"/);
    assert.match(html, /data-testid="block-lifeyard-story" class="rc-fit-split has-intro"/);
    assert.doesNotMatch(html, /rc-story-centered/);
    assert.match(html, /Our saved opening paragraph/);
    assert.match(html, /Our saved second paragraph/);
    assert.match(html, /class="rc-bento-grid rc-boxes[^"]*" data-n="4" aria-label="Programme costs"/);
    assert.match(html, /50 drums for hands-on learning, practice and performance/);
    assert.match(html, /Drumming tuition/);
    assert.match(html, /Locally donated space/);
    assert.match(html, /Keep this custom row exactly as written/);
    assert.match(html, /Our saved intro explains a funding gap, without hiding anything/);
    assert.doesNotMatch(html, /not itemised|six listed budget items/);
    assert.match(html, /block-drum-circle/);
    assert.equal((html.match(/data-testid="button-drum-\d+"/g) ?? []).length, 50);
  }
  for (const [c, org] of [
    [campaign, { ...organisation, _id: "hov", name: "Humanity Ova Vanity" }],
    [{ ...campaign, _id: "another-lifeyard-campaign" }, organisation],
  ]) {
    const html = render(c, org);
    assert.doesNotMatch(html, /block-lifeyard-story|Programme costs|Drumming tuition/);
    assert.match(html, /The story/);
    assert.match(html, /What your money buys/);
  }
});

test("campaign headings and box grids share the same responsive section rules", async () => {
  const css = await readFile(new URL("src/components/campaign/campaign-redesign.css", webRoot), "utf8");
  const page = await readFile(new URL("src/components/campaign/campaign-page-view.tsx", webRoot), "utf8");
  const bespoke = await readFile(new URL("src/components/campaign/lifeyard-sections.tsx", webRoot), "utf8");
  for (const name of ["storyFitRef", "programmeFitRef", "outcomesFitRef", "teamFitRef", "moneyFitRef", "wallFitRef"])
    assert.match(page, new RegExp(`ref=\\{${name}\\}[^>]*className=.*rc-fit-split`));
  assert.match(bespoke, /block-lifeyard-story" className="rc-fit-split has-intro"/);
  assert.match(bespoke, /className="rc-bento-grid rc-boxes[^"]*" data-n=\{rows.length\}/);
  assert.match(css, /@container rc \(min-width: 700px\)/);
  assert.match(css, /rc-boxes\[data-n="5"\] > :nth-child\(n\+4\).*span 3/);
  assert.match(css, /:last-child:nth-child\(n\+7\):nth-child\(3n \+ 1\).*span 6/);
  assert.match(css, /rc\[data-layout="phone"\] \.rc-boxes.*span 6/);
});

test("Who's running it retains Lifeyard's details without changing other campaigns", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const render = (orgId: string, layout: string) => renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignPageView, {
      campaign: { _id: "9d5e9d29323a434f8706", name: "Drum Life", type: "fundraising",
        currency: "usd", goal: 18000, amountRaised: 0, status: "active", enabled: false },
      organisation: { _id: orgId, name: "Lifeyard", country: "Jamaica" }, layout, preview: true,
    })));
  for (const layout of ["phone", "desktop", "responsive"]) {
    const html = render("LTMwjXVEgxNideK0XtIQudxZXjc2", layout);
    assert.match(html, /rc-organiser-centered" data-testid="block-organisation">[\s\S]*?<h2[^>]*>Who&#x27;s running it<\/h2>[\s\S]*?class="rc-bento/);
    assert.doesNotMatch(render("another-organisation", layout), /rc-organiser-centered/);
  }
  const css = await readFile(new URL("src/components/campaign/campaign-redesign.css", webRoot), "utf8");
  assert.match(css, /\.rc-organiser-centered > \.rc-h2 \{ text-align: center; \}/);
});

test("Lifeyard budget purpose labels use real descriptions, not row positions or invented claims", async () => {
  const { DRUM_LIFE_COPY, drumBudgetPurpose } = await loadComponent("src/lib/drum-life-copy.ts");
  const descriptions = [
    "50 drums for hands-on learning, practice and performance.",
    "Three months of drumming tuition with master drummer Moustafa Reds.",
    "Workshop spaces where children can come together to learn and rehearse.",
    "Transport and refreshments to help children attend and participate in the workshops.",
    "An on-site social worker to support the children’s wellbeing and provide a trusted person.",
    "Contingency fund to cover unforeseen programme costs.",
  ];
  assert.deepEqual(descriptions.map(drumBudgetPurpose),
    ["50 drums", "Drumming tuition", "Workshop spaces", "Transport & refreshments", "On-site wellbeing support", "Contingency"]);
  assert.equal(drumBudgetPurpose("An organisation's new custom purpose."), null);
  assert.doesNotMatch(DRUM_LIFE_COPY.budgetIntro, /18,?000|16,?000|2,?000|not itemised/);
});

test("legacy unit settings cannot give an unrelated campaign a hand wall", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const render = (singular: string, imageUrl: string | null = null) =>
    renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
      createElement(CampaignPageView, {
        campaign: { _id: "camp", name: "A real campaign", type: "fundraising", goal: 100,
          amountRaised: 3, status: "active", supporterCount: 1,
          theme: { unit: { singular, plural: `${singular}s`, imageUrl } },
          recentSupporters: [{ displayName: "Consenting supporter", createdAt: "2026-01-01" }] },
        organisation: { _id: "org", name: "Community organisation" }, layout: "phone",
      })));
  for (const unit of ["hand", "brick", "seedling", "drop"]) {
    assert.doesNotMatch(render(unit), /canvas-accumulation|campaign-units\/|your hand is on the wall|Latest hands/);
    assert.match(render(unit), /lucide-heart/);
  }
  assert.doesNotMatch(render("hand", "https://example.test/custom.svg"), /example.test\/custom.svg/);
  assert.doesNotMatch(render("custom unit"), /src="\/campaign-units\//);
});

test("Lifeyard budget formats dollar labels without changing values and honours forced phone previews", async () => {
  const { LifeyardBreakdown, formatCostLabel } = await loadComponent("src/components/campaign/lifeyard-sections.tsx");
  for (const [label, expected] of [
    ["$7500", "US$7,500"], ["$2,850 ", "US$2,850"], ["$ 650", "US$650"],
    ["Donated instruments", "Donated instruments"], ["$75 per session", "$75 per session"],
    ["$1,00", "$1,00"], ["£200", "£200"],
  ]) assert.equal(formatCostLabel(label, "usd"), expected);
  assert.equal(formatCostLabel("£200", "gbp"), "£200");
  const props = { heading: "What your money buys", summary: "", intro: [], afterword: [],
    rows: [{ label: "$7500", detail: "Our saved cost description." }], red: "#B50000", gold: "#F5B800" };
  const phone = renderToStaticMarkup(createElement(LifeyardBreakdown, { ...props, currency: "usd", layout: "phone" }));
  assert.match(phone, /US\$7,500/);
  assert.doesNotMatch(phone, /sm:grid-cols|grid-cols-\[8.5rem/);
  assert.match(phone, /All listed amounts are in US dollars/);
  const gbp = renderToStaticMarkup(createElement(LifeyardBreakdown, { ...props, currency: "gbp", layout: "desktop" }));
  assert.doesNotMatch(gbp, /All listed amounts are in US dollars/);
  const detailOnly = renderToStaticMarkup(createElement(LifeyardBreakdown, { ...props,
    rows: [{ detail: "Only this description" }], currency: "usd", layout: "desktop" }));
  assert.doesNotMatch(detailOnly, /grid-cols-\[8.5rem/);
});

test("USD campaign sheet displays dollars and sends USD without changing organisation-level GBP", async () => {
  const { GuestDonateSheet, guestCheckoutBody } = await loadComponent("src/components/GuestDonateSheet.tsx");
  const html = renderSheet(GuestDonateSheet, { campaignId: "usd-campaign", campaignName: "Skills",
    currency: "usd" });
  assert.match(html, /\$25/);
  assert.doesNotMatch(html, /£25/);
  assert.equal(guestCheckoutBody("org", 500, "usd-campaign", "anon", false, "", "usd").currency, "usd");
  const orgHtml = renderSheet(GuestDonateSheet, { currency: "usd" });
  assert.match(orgHtml, /£25/);
});

test("real campaign public/preview component renders multiple captioned videos, USD totals, and no empty video boxes", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const organisation = { _id: "org", name: "Community Trust", country: "Jamaica" };
  const campaign = { _id: "campaign", name: "Skills for life", currency: "usd", type: "fundraising",
    goal: 1000, amountRaised: 25, description: "", phases: [], status: "active", enabled: true,
    videos: [
      { url: "/api/uploads/object/first.mp4", posterUrl: null, captionsUrl: null, caption: "First workshop" },
      { url: "https://youtu.be/test123", posterUrl: null, captionsUrl: null, caption: "Building together" },
      { url: "", posterUrl: null, captionsUrl: null, caption: "Not uploaded" },
    ],
  };
  const render = (c: any, preview: boolean) => renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignPageView, { campaign: c, organisation, preview, layout: "phone" })));
  for (const preview of [true, false]) {
    const html = render(campaign, preview);
    assert.equal((html.match(/data-testid="block-campaign-video"/g) ?? []).length, 2);
    assert.match(html, /First workshop/);
    assert.match(html, /Building together/);
    assert.doesNotMatch(html, /Not uploaded/);
    assert.match(html, /\$1,000/);
    assert.doesNotMatch(html, /£1,000/);
    assert.equal((render({ ...campaign, videos: [], video: campaign.videos[0] }, preview)
      .match(/data-testid="block-campaign-video"/g) ?? []).length, 0);
    const { videos, ...legacy } = campaign;
    assert.equal((render({ ...legacy, video: campaign.videos[0] }, preview)
      .match(/data-testid="block-campaign-video"/g) ?? []).length, 1);
  }
});

test("campaign cards expose a full-card accessible link without nesting the donation button", async () => {
  const { CampaignCardLink } = await loadComponent("src/components/campaign-card-link.tsx");
  const markup = renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignCardLink, { href: "/campaigns/community/youth-arts", name: "Youth Arts" },
      createElement("button", { className: "relative z-10" }, "Donate to this campaign"))));
  assert.match(markup, /href="\/campaigns\/community\/youth-arts"/);
  assert.match(markup, /aria-label="Open campaign: Youth Arts"/);
  assert.match(markup, /absolute inset-0 z-\[1\]/);
  assert.match(markup, /<\/a><button class="relative z-10"/);
  assert.doesNotMatch(markup, /<a[^>]*>[^<]*<button/);
});

test("draft card opens its existing editor while preview and delete remain separate controls", async () => {
  const { CampaignEditorCard } = await loadComponent("src/components/campaign-builder/campaign-editor-card.tsx");
  let edits = 0, deletions = 0;
  const card = CampaignEditorCard({
    id: "draft-1", name: "Out of Many Hands", onEdit: () => edits++,
    children: [
      createElement("a", { key: "preview", href: "/campaign/preview/org/draft-1", className: "relative z-10" }, "Preview as donor"),
      createElement("button", { key: "delete", className: "relative z-10", onClick: () => deletions++ }, "Delete"),
    ],
  });
  const overlay = card.props.children[0];
  assert.equal(overlay.type, "button");
  assert.equal(overlay.props.type, "button");
  assert.equal(overlay.props["aria-label"], "Continue editing Out of Many Hands");
  overlay.props.onClick();
  assert.equal(edits, 1);
  const markup = renderToStaticMarkup(card);
  assert.match(markup, /absolute inset-0 z-\[1\]/);
  assert.match(markup, /<\/button><a /, "preview is a sibling, not nested in the editor button");
  assert.equal(card.props.onClick, undefined, "secondary controls cannot bubble into an editor action");
  card.props.children[1][1].props.onClick();
  assert.equal(deletions, 1);
  assert.equal(edits, 1);
  const busy = CampaignEditorCard({ id: "draft-1", name: "", onEdit() {}, disabled: true, children: null });
  assert.equal(busy.props.children[0].props.disabled, true);
  assert.equal(busy.props.children[0].props["aria-label"], "Continue editing Untitled draft");
  const live = renderToStaticMarkup(createElement(CampaignEditorCard, { id: "live", name: "Live", children: "Live campaign" }));
  assert.doesNotMatch(live, /button-open-draft/);
});

test("donor-icon hit testing respects rotation, overlap and newest-first name ordering", async () => {
  const { hitSupporterUnit, supporterUnitName } = await loadComponent("src/lib/supporter-unit-hit.ts");
  const lower = { x: 30, y: 30, s: 20, r: 0, index: 0 };
  const upper = { x: 30, y: 30, s: 12, r: Math.PI / 4, index: 1 };
  assert.equal(hitSupporterUnit([lower, upper], 30, 30).index, 1);
  assert.equal(hitSupporterUnit([upper], 38, 30).index, 1, "rotated edge is inside");
  assert.equal(hitSupporterUnit([upper], 38, 38), null, "outside the rotated square");
  assert.equal(hitSupporterUnit([lower, upper], 100, 100), null);
  const names = [{ displayName: "Newest N." }, { displayName: "Anonymous" }, { displayName: "Oldest O." }];
  assert.equal(supporterUnitName(names, 3, 2), "Newest N.");
  assert.equal(supporterUnitName(names, 3, 1), "Anonymous");
  assert.equal(supporterUnitName(names, 3, 0), "Oldest O.");
  assert.equal(supporterUnitName([], 3, 0), "Anonymous");
  assert.equal(supporterUnitName(names, 300, 299), "Newest N.");
});

test("accumulation animation clamps early RAF timestamps instead of indexing a negative unit", async () => {
  const { accumulationProgress } = await loadComponent("src/lib/supporter-unit-hit.ts");
  assert.equal(accumulationProgress(99, 100, 1400), 0);
  assert.equal(accumulationProgress(100, 100, 1400), 0);
  assert.equal(accumulationProgress(800, 100, 1400), 0.5);
  assert.equal(accumulationProgress(2000, 100, 1400), 1);
});

test("campaign Donate button delivers its id and name to the sheet and checkout body", async () => {
  const { CampaignDonateButton } = await loadComponent("src/components/campaign-donate-button.tsx");
  const { GuestDonateSheet, guestCheckoutBody } = await loadComponent("src/components/GuestDonateSheet.tsx");
  const campaign = { _id: "camp-123", name: "Youth Arts" };
  let selected: typeof campaign | null = null;
  const button = CampaignDonateButton({
    campaign, onDonate: (c: typeof campaign) => { selected = c; }, children: "Donate",
  });
  button.props.onClick();
  assert.deepEqual(selected, campaign);
  const chosen = selected as typeof campaign | null;
  assert.ok(chosen);
  const sheet = renderSheet(GuestDonateSheet, {
    campaignId: chosen._id, campaignName: chosen.name,
  });
  assert.match(sheet, /Donating to<\/p><h2[^>]*>Youth Arts<\/h2>/);
  assert.match(sheet, /<p[^>]*>Community Trust<\/p>/);
  assert.ok(sheet.includes(encodeURIComponent("?campaign=camp-123")));
  assert.deepEqual(guestCheckoutBody("org-1", 300, chosen._id, "anon-1"), {
    orgId: "org-1", amountPence: 300, currency: "gbp", campaignId: "camp-123", anonymousDonorId: "anon-1",
  });
  assert.deepEqual(guestCheckoutBody("org-1", 300, chosen._id, "anon-1", true, " Alex Taylor "), {
    orgId: "org-1", amountPence: 300, currency: "gbp", campaignId: chosen._id, anonymousDonorId: "anon-1",
    wallOptIn: true, donorName: "Alex Taylor",
  });
  const optedOut = guestCheckoutBody("org-1", 300, chosen._id, "anon-1", false, "Alex Taylor");
  assert.equal(Object.hasOwn(optedOut, "donorName"), false, "unchecking removes the public name from the request");
});

test("organisation Donate stays unassigned to a campaign", async () => {
  const { GuestDonateSheet, guestCheckoutBody } = await loadComponent("src/components/GuestDonateSheet.tsx");
  const sheet = renderSheet(GuestDonateSheet, {});
  assert.match(sheet, /Donating to<\/p><h2[^>]*>Community Trust<\/h2>/);
  assert.doesNotMatch(sheet, /campaign%3D/);
  assert.deepEqual(guestCheckoutBody("org-1", 300, undefined, "anon-1"), {
    orgId: "org-1", amountPence: 300, currency: "gbp", anonymousDonorId: "anon-1",
  });
});

test("redesigned hero preserves inline gifts, canonical disclosures and an active donate action", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const props = {
    campaign: { _id: "camp", name: "Out of Many Hands", type: "fundraising", goal: 30000,
      amountRaised: 3, enabled: true, status: "active", phases: [], currency: "gbp",
      pageContent: { donateLabel: "Support the training", cohortName: "January cohort" } },
    organisation: { _id: "org", name: "Humanity Ova Vanity", country: "Jamaica" },
    layout: "phone",
  };
  const render = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(
    createElement(Router, { hook: () => ["/", () => {}] }, createElement(CampaignPageView, { ...props, ...extra })));
  const html = render();
  assert.match(html, /Support the training/);
  assert.match(html, /For January cohort/);
  assert.match(html, /rc-display/);
  assert.doesNotMatch(html, /Dancing Script|Instrument Serif|Playfair Display|Choose your amount at the next step/);
  assert.match(html, /rc-amounts/);
  assert.match(html, /Root ProjX platform fee \(5%\)/);
  assert.match(html, /Card processing \(estimated\)/);
  assert.match(html, /data-testid="text-org-receives">£9\.50/);
  assert.match(html, /data-testid="text-total-charged">£10\.35/);
  assert.match(html, /class="rc-give-btn" data-testid="button-donate-campaign">Give £10\.35/);
  assert.doesNotMatch(html, /marker-your-hand|panel-donate-thanks/);
  const preview = render({ preview: true });
  assert.match(preview, /disabled=""[^>]*data-testid="button-donate-campaign"/);
});

test("hero choice and sheet checkout charge the same intended gift and fee, in either currency", async () => {
  const { donationPence } = await loadComponent("src/components/campaign/campaign-donate-panel.tsx");
  const { GuestDonateSheet, guestCheckoutBody } = await loadComponent("src/components/GuestDonateSheet.tsx");
  for (const [currency, fee] of [["gbp", 35], ["usd", 63]] as const) {
    for (const covered of [true, false]) {
      const p = donationPence(10, covered, currency);
      assert.deepEqual(p, { intendedPence: 1000, feePence: covered ? fee : 0, chargedPence: 1000 + (covered ? fee : 0) });
      const body = guestCheckoutBody("org", 1000, "camp", "anon", false, "", currency, covered);
      assert.equal(body.amountPence, p.chargedPence);
      assert.equal(body.originalAmountPence ?? body.amountPence, 1000);
      assert.equal(body.feeCovered ?? false, covered);
      assert.equal(body.currency, currency);
      assert.equal(body.campaignId, "camp");
      assert.equal(Object.hasOwn(body, "donorName"), false);
      const html = renderSheet(GuestDonateSheet, { campaignId: "camp", currency,
        initialAmount: 10, initialFeeCovered: covered });
      assert.match(html, new RegExp(`Donate ${currency === "usd" ? "\\$" : "£"}${(p.chargedPence / 100).toFixed(2).replace(".", "\\.")}`));
    }
  }
});

test("confirmed thank-you displays the recorded native gift, not the currently selected amount", async () => {
  const { CampaignDonatePanel } = await loadComponent("src/components/campaign/campaign-donate-panel.tsx");
  const html = renderToStaticMarkup(createElement(CampaignDonatePanel, {
    currency: "usd", orgName: "Community Trust", cohortName: "January",
    receipt: { amount: 3, currency: "usd" }, onDonate() {}, onShare() {},
  }));
  assert.match(html, /Your hand is on the wall/);
  assert.match(html, /\$3\.00/);
  assert.doesNotMatch(html, /\$10|button-donate-campaign/);
  assert.match(html, /for January/);
  assert.match(html, /Share the wall with your people/);
});

test("matching disclosure includes processing top-up in what the donor is charged", async () => {
  const { GuestDonateSheet } = await loadComponent("src/components/GuestDonateSheet.tsx");
  const html = renderSheet(GuestDonateSheet, {
    campaignId: "matching-camp", initialAmount: 10, initialFeeCovered: true,
    partnerFunding: { type: "matching", amount: 100, matchCap: 100, matchRatio: 1, funderName: "Partner" },
  });
  assert.match(html, /You are charged £10\.35/);
  assert.doesNotMatch(html, /charged only £10\.00|You are charged £10\.00/);
});

test("confirmed receipt acknowledgement is private, campaign-scoped, expiring and consumed once", async () => {
  const { storeConfirmedReceipt, consumeConfirmedReceiptDetails } = await loadComponent("src/lib/donor-identity.ts");
  const before = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  } });
  try {
    assert.equal(consumeConfirmedReceiptDetails("camp"), null);
    storeConfirmedReceipt("camp", { amount: 3, currency: "usd" });
    assert.equal(consumeConfirmedReceiptDetails("other-campaign"), null);
    assert.deepEqual(consumeConfirmedReceiptDetails("camp"), { amount: 3, currency: "usd" });
    assert.equal(consumeConfirmedReceiptDetails("camp"), null);
    for (const timestamp of [Date.now() - 31 * 60000, Date.now() + 60000]) {
      data.set("rpx_confirmed_receipt_camp", JSON.stringify({ t: timestamp, amount: 3, currency: "gbp" }));
      assert.equal(consumeConfirmedReceiptDetails("camp"), null);
    }
    data.set("rpx_confirmed_receipt_camp", String(Date.now()));
    assert.deepEqual(consumeConfirmedReceiptDetails("camp"), { amount: null, currency: "gbp" });
  } finally {
    if (before) Object.defineProperty(globalThis, "sessionStorage", before);
    else delete (globalThis as any).sessionStorage;
  }
});
