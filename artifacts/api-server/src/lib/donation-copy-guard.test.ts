/*
 * The organisation receives the intended donation minus the 5% platform fee,
 * and minus card processing unless the donor covers it. No single percentage
 * describes what reaches them, and every attempt to state one has been wrong.
 * Keep donor-facing copy honest: monetary breakdowns must come from the canonical
 * accounting helper, not hard-coded proceeds or blanket percentage promises.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = new URL("../../../../", import.meta.url).pathname;
const textExtensions = /\.(?:[cm]?[jt]sx?|html?|mdx?|txt|json|ya?ml|hbs|ejs|css)$/i;
const excluded = new Set([
  "node_modules", ".git", ".local", ".agents", "attached_assets", "dist", "build",
  "generated-artifacts", "coverage", ".expo", ".cache", ".replit-artifact",
]);

async function* files(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else if (entry.isFile() && textExtensions.test(file) && !/\.(?:test|spec|d)\.[cm]?[jt]sx?$/i.test(file)) yield file;
  }
}

function normalize(text: string): string {
  return text.normalize("NFKC")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&(?:percnt|#37|#x25);/gi, "%")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ").trim();
}

const recipient = String.raw`(?:the\s+)?(?:organi[sz]ations?|orgs?|charit(?:y|ies))`;
const destination = new RegExp(String.raw`\b(?:reaches?\s+|go(?:es)?\s+to\s+)${recipient}\b`, "i");
const receives = new RegExp(String.raw`\b${recipient}\s+(?:receives?|gets?|keeps?)\b`, "i");
const percentage = /(?:\b\d+(?:[.,]\d+)?|\bDYNAMIC)\s*%/gi;

function violations(copy: string): string[] {
  const text = normalize(copy);
  const errors = new Set<string>();
  if (/\b95(?:[.,]0+)?\s*%/.test(text)) errors.add("95% proceeds claim");
  if (/\b100\s*%\s*of\s+(?:your|my|the|each|every)\s+donations?\b/i.test(text)) errors.add("100% of a donation");
  if (/\b100\s*%\s*(?:(?:of\s+)?(?:it|the\s+money)\s+)?reaches?\b/i.test(text)) errors.add("100% reaches");
  if (/\b(?:the\s+)?full\s+amount\s+reaches?\b/i.test(text)) errors.add("full amount reaches");
  for (const match of text.matchAll(percentage)) {
    const before = text.slice(Math.max(0, match.index! - 100), match.index);
    const after = text.slice(match.index! + match[0].length, match.index! + match[0].length + 100);
    // Exempt only the percentage explicitly describing the platform fee, not
    // every sentence mentioning it (which could also contain a false net claim).
    const feeContext = /platform\s+fee\s*(?:(?:of|is|at)\s*)?[:(]?\s*$/i.test(before) ||
      /^\s*(?:Root\s+ProjX\s+)?platform\s+fee\b/i.test(after);
    if (/^(?:5(?:[.,]0+)?|DYNAMIC)\s*%$/i.test(match[0]) && feeContext) continue;
    if (destination.test(before + after) || receives.test(before + after)) errors.add("percentage tied to organisation proceeds");
  }
  // A concrete receipt example is fine, but its proceeds must be interpolated
  // from canonical accounting too; literal £2.85/£2.60 would silently go stale.
  if (/\breceives?\s*[:—-]?\s*£\s*\d/i.test(text) ||
    new RegExp(String.raw`£\s*\d[\d.,]*\s+(?:reaches?\s+|go(?:es)?\s+to\s+)${recipient}\b`, "i").test(text)) {
    errors.add("literal organisation proceeds; use canonical accounting");
  }
  return [...errors];
}

function literal(node: ts.Node): string {
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || ts.isJsxText(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map(s => literal(s.expression) + s.literal.text).join("");
  if (ts.isJsxElement(node) || ts.isJsxFragment(node)) return node.children.map(literal).join(" ");
  if (ts.isJsxExpression(node)) return node.expression ? literal(node.expression) : " ";
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return literal(node.left) + literal(node.right);
  return " DYNAMIC ";
}

function structural(node: ts.Node): boolean {
  // CSS percentages and Tailwind classes aren't donation copy.
  for (let n: ts.Node | undefined = node; n && !ts.isSourceFile(n); n = n.parent) {
    if (ts.isJsxAttribute(n) && ["style", "className"].includes(n.name.getText())) return true;
    if (ts.isPropertyAssignment(n) && /^(?:width|height|minWidth|maxWidth|minHeight|maxHeight|background|backgroundImage|transform|flexBasis)$/.test(n.name.getText().replace(/["']/g, ""))) return true;
  }
  return false;
}

function scan(source: string, filename: string): string[] {
  const findings = new Set<string>();
  const check = (text: string, line: number) => {
    for (const error of violations(text)) findings.add(`${filename}:${line}: ${error}`);
  };
  if (/\.[cm]?[jt]sx?$/i.test(filename)) {
    const sf = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
      filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (!structural(node) && (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node) ||
        ts.isJsxText(node) || ts.isJsxElement(node) || ts.isJsxFragment(node) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken))) {
        check(literal(node), sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  } else if (filename.endsWith(".css")) {
    for (const match of source.matchAll(/\bcontent\s*:\s*(["'])(.*?)\1/gs)) {
      check(match[2], source.slice(0, match.index).split("\n").length);
    }
  } else {
    for (const error of violations(source)) findings.add(`${filename}: ${error}`);
  }
  return [...findings];
}

test("copy guard rejects false net claims, including markup, template and email variants", () => {
  for (const copy of [
    "<p>95%</p>", '<p>100% of your donation supports the organisation</p>',
    '<p>100% reaches our partners</p>', '<p>The full amount reaches them</p>',
    '<p>90% of your donation reaches the organisation</p>',
    '<p>80% goes to the organization</p>', '<p>5% goes to the organisation</p>',
    '<p>The organisation receives 97.5%.</p>',
    '<p>Root ProjX platform fee is 5%; 95% reaches the organisation.</p>',
    '<p><strong>100%</strong> of your <em>donation</em> reaches them</p>',
    '<p>95&#37;&nbsp;goes to the organisation</p>',
    'const email = `<p>100%\\n reaches ${orgName}</p>`;',
    'const label = "100% of your " + "donation";',
    'const label = `${percent}% reaches the organisation`;',
    '<p>The organisation receives £2.85</p>',
  ]) assert.ok(scan(copy, "fixture.tsx").length, `Missed forbidden copy: ${copy}`);
});

test("copy guard allows the platform fee, canonical figures and unrelated layout percentages", () => {
  for (const copy of [
    '<p>Root ProjX platform fee: 5%.</p>',
    '<p>After the 5% Root ProjX platform fee, the rest goes to the organisation.</p>',
    '<p>The platform fee is 5%; the remainder reaches the organisation.</p>',
    '<p>{org.name} receives {money(accounting.toOrgGbp)}.</p>',
    'const email = `${escapeHtml(disclosure.orgLine)}`;',
    '<div style={{ width: "95%", height: "100%" }} className="w-[95%]">Donate</div>',
    '// Never promise 95% or 100% of your donation.\nconst label = "Donate";',
  ]) assert.deepEqual(scan(copy, "fixture.tsx"), [], `Rejected valid copy: ${copy}`);
  assert.ok(scan("<p>90% goes to the organisation.</p>", "terms.html").length);
  assert.ok(scan("100% of your donation", "privacy-policy.md").length);
});

test("donor pages, components, donation email and all terms/policy copy have no literal proceeds promises", async () => {
  const targets = new Set<string>();
  for (const dir of ["artifacts/web/src/pages", "artifacts/web/src/components"]) {
    for await (const file of files(path.join(root, dir))) targets.add(file);
  }
  const email = path.join(root, "artifacts/api-server/src/lib/brevo.ts");
  targets.add(email);
  // The shared disclosure builds the copy that web pages and Brevo interpolate.
  targets.add(path.join(root, "artifacts/api-server/src/lib/donation-accounting.ts"));
  for await (const file of files(root)) {
    if (/(?:terms|polic(?:y|ies)|privacy|legal)/i.test(path.relative(root, file))) targets.add(file);
  }
  assert.ok(targets.size > 2, "Donor-facing scan must not silently become empty.");
  const findings: string[] = [];
  for (const file of [...targets].sort()) findings.push(...scan(await readFile(file, "utf8"), path.relative(root, file)));
  assert.deepEqual(findings, [], `False donation copy found. Use canonical accounting fields instead:\n${findings.join("\n")}`);
});
