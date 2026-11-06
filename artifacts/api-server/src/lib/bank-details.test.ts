import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { createCipheriv } from "node:crypto";
import { build } from "esbuild";
import { validateBankDetails, encryptBankDetails, decryptBankDetails } from "./bank-details.ts";
import { fsMutateBankDetails } from "./firebase-rest.ts";
import { parseBankEnvelope } from "./bank-envelope.ts";
import { bankAudit } from "./bank-audit.ts";

const syntheticKey = Buffer.alloc(32, 17).toString("base64");
const input = {
  accountHolder: "Example Organisation", bankName: "Example Bank",
  bankCountry: "GB", currency: "GBP", accountNumber: "12345678", routingCode: "12-34-56",
};

test("bank validation requires a payee, account identifier and country-specific routing", () => {
  assert.equal(validateBankDetails(input).currency, "GBP");
  for (const invalid of [
    { ...input, accountHolder: "" }, { ...input, routingCode: "" },
    { ...input, accountNumber: "", iban: "" }, { ...input, password: "not accepted" },
    { ...input, iban: "GB00INVALID" }, { ...input, swiftBic: "bad" },
    { ...input, bankCountry: "US", routingCode: "123" },
  ]) assert.throws(() => validateBankDetails(invalid));
  assert.equal(validateBankDetails({ ...input, accountNumber: "", routingCode: "", iban: "GB82WEST12345698765432" }).iban, "GB82WEST12345698765432");
});

test("bank records are authenticated encrypted, randomised, org-bound and fail closed without a dedicated key", () => {
  const previous = process.env.BANK_DETAILS_ENCRYPTION_KEY;
  try {
    process.env.BANK_DETAILS_ENCRYPTION_KEY = syntheticKey;
    const details = validateBankDetails(input);
    const a = encryptBankDetails(details, "org-a"), b = encryptBankDetails(details, "org-a");
    assert.notEqual(a, b);
    assert.ok(!a.includes(input.accountNumber) && !a.includes(input.accountHolder));
    assert.deepEqual(decryptBankDetails(a, "org-a"), details);
    assert.throws(() => decryptBankDetails(a, "org-b"));
    assert.ok(a.startsWith("v2.primary."));
    assert.notEqual(parseBankEnvelope(a).iv, parseBankEnvelope(b).iv);
    const parts = a.split("."); parts[3] = Buffer.alloc(16).toString("base64");
    assert.throws(() => decryptBankDetails(parts.join("."), "org-a"));
    assert.throws(() => decryptBankDetails(a.replace("v2.primary.", "v2.unknown."), "org-a"));
    const iv = Buffer.alloc(12, 7);
    const legacy = createCipheriv("aes-256-gcm", Buffer.from(syntheticKey, "base64"), iv);
    legacy.setAAD(Buffer.from("rootprojx:bank-details:v1:org-a"));
    const ciphertext = Buffer.concat([legacy.update(JSON.stringify(details), "utf8"), legacy.final()]);
    const v1 = ["v1", iv.toString("base64"), legacy.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
    assert.deepEqual(decryptBankDetails(v1, "org-a"), details);
    delete process.env.BANK_DETAILS_ENCRYPTION_KEY;
    assert.throws(() => encryptBankDetails(details, "org-a"), /not configured/);
  } finally {
    if (previous === undefined) delete process.env.BANK_DETAILS_ENCRYPTION_KEY;
    else process.env.BANK_DETAILS_ENCRYPTION_KEY = previous;
  }
});

async function fixture() {
  const compiled = await build({
    stdin: { contents: 'export {default as router} from "../routes/bank-details.ts"; export {state} from "bank:state";',
      resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    define: { "process.env.BANK_DETAILS_ENCRYPTION_KEY": JSON.stringify(syntheticKey) },
    plugins: [{
      name: "private-bank-fixture",
      setup(b) {
        b.onResolve({ filter: /^bank:state$/ }, () => ({ path: "state", namespace: "bank" }));
        b.onResolve({ filter: /\/lib\/(firebase-rest|auth|admin-auth)\.js$/ }, a => ({ path: a.path.split("/").pop()!, namespace: "bank" }));
        b.onLoad({ filter: /.*/, namespace: "bank" }, a => ({
          loader: "js",
          contents: a.path === "state" ? `export const state={org:{payoutMethod:"bank_transfer",payoutManualApproved:true},record:null,logs:[],audits:[],fail:false,failAudit:false};`
            : a.path === "firebase-rest.js" ? `
              import {state} from "bank:state";
              export const getServerToken=async()=>"synthetic-server";
              export const fsGet=async(c,id)=> c==="organisations" ? id==="owner" ? {...state.org} : null : state.record;
              export const fsCreateIfAbsent=async(c,id,record,token)=>{
                if(state.failAudit) throw Error("Audit unavailable");
                state.audits.push({id,...record}); return true;
              };
              export const fsMutateBankDetails=async(id,token,mutate,audit)=>{
                if(state.fail) throw Error("Private provider payload");
                const value=mutate({...state.org},state.record);
                if(audit && state.failAudit) throw Error("Audit unavailable");
                state.org={...state.org,...value.orgUpdates};
                if(value.record) state.record=value.record;
                if(audit) state.audits.push({id:audit.id,...audit.record});
                return value.result;
              };`
            : a.path === "admin-auth.js" ? `export const requireAdmin=(req,res,next)=>req.headers["x-admin-token"]==="synthetic-admin"?next():res.status(401).json({error:"Unauthorized"});`
            : `export const requireAuth=(req,res,next)=>{
                if(req.headers.authorization!=="Bearer owner") return res.status(401).json({error:"Unauthorized"});
                req.user={userId:"owner",accountType:"organisation"}; next();
              }; export const requireApprovedOrganisation=(req,res,next)=>next();`,
        }));
      },
    }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { router, state } = mod.exports;
  async function request(path: string, method = "get", body = {}, headers: Record<string, string> = {}) {
    const route = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
    let status = 200, data: any;
    const req = { params: { id: "owner" }, body, headers, log: { error: (...args: unknown[]) => state.logs.push(args), info: (...args: unknown[]) => state.logs.push(args) } };
    const res = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { data = value; return this; } };
    for (const layer of route.stack) {
      let next = false;
      await layer.handle(req, res, () => { next = true; });
      if (!next) break;
    }
    return { status, data };
  }
  return { state, request };
}

test("only owner can submit; save encrypts privately, revokes approval, and owner reads never return account details", async () => {
  const f = await fixture(), owner = { authorization: "Bearer owner" };
  assert.equal((await f.request("/payout/bank-details", "put", input)).status, 401);
  assert.equal((await f.request("/payout/bank-details", "put", { ...input, orgId: "other" }, owner)).status, 400);
  const saved = await f.request("/payout/bank-details", "put", input, owner);
  assert.equal(saved.status, 200); assert.equal(saved.data.approved, false);
  assert.equal(f.state.org.payoutManualApproved, false);
  assert.ok(f.state.record.encrypted.startsWith("v2.primary."));
  assert.equal(f.state.record.accountNumber, undefined);
  assert.equal(f.state.org.encrypted, undefined);
  const status = await f.request("/payout/bank-details", "get", {}, owner);
  assert.equal(status.data.hasDetails, true);
  assert.doesNotMatch(JSON.stringify([saved, status, f.state.logs]), /12345678|Example Bank|Example Organisation/);
});

test("admin explicitly reviews full details and approves only the exact revision; edits invalidate old approvals", async () => {
  const f = await fixture(), owner = { authorization: "Bearer owner" }, admin = { "x-admin-token": "synthetic-admin" };
  const path = "/admin/organisations/:id/bank-details";
  const saved = await f.request("/payout/bank-details", "put", input, owner);
  assert.equal((await f.request(path, "get", {}, owner)).status, 401);
  const review = await f.request(path, "get", {}, admin);
  assert.equal(review.data.details.accountNumber, input.accountNumber);
  assert.equal(f.state.audits.length, 1);
  assert.deepEqual(Object.keys(f.state.audits[0]).sort(),
    ["id", "adminIdentity", "identityType", "action", "timestamp", "orgId", "revision"].sort());
  assert.equal(f.state.audits[0].action, "reveal");
  assert.equal(f.state.audits[0].adminIdentity, "shared-admin");
  assert.equal(f.state.audits[0].revision, saved.data.revision);
  assert.equal((await f.request(path + "/approve", "post", { revision: "stale" }, admin)).status, 409);
  assert.equal((await f.request(path + "/approve", "post", { revision: saved.data.revision }, admin)).status, 200);
  assert.equal(f.state.org.payoutManualApproved, true);
  assert.equal(f.state.audits.length, 2);
  assert.equal(f.state.audits[1].action, "approve");
  assert.notEqual(f.state.audits[0].id, f.state.audits[1].id);
  assert.doesNotMatch(JSON.stringify(f.state.audits), /12345678|Example Bank|Example Organisation/);
  await f.request("/payout/bank-details", "put", { ...input, accountNumber: "87654321" }, owner);
  assert.equal(f.state.org.payoutManualApproved, false);
  assert.equal((await f.request(path + "/approve", "post", { revision: saved.data.revision }, admin)).status, 409);
});

test("masked admin status never decrypts; failed audits prevent reveal and approval", async () => {
  const f = await fixture(), owner = { authorization: "Bearer owner" }, admin = { "x-admin-token": "synthetic-admin" };
  const path = "/admin/organisations/:id/bank-details";
  const saved = await f.request("/payout/bank-details", "put", input, owner);
  const masked = await f.request(path + "/status", "get", {}, admin);
  assert.equal(masked.data.hasDetails, true);
  assert.equal(masked.data.details, undefined);
  assert.equal(f.state.audits.length, 0);
  assert.doesNotMatch(JSON.stringify(masked), /12345678|Example Bank|Example Organisation/);
  f.state.failAudit = true;
  assert.equal((await f.request(path, "get", {}, admin)).status, 503);
  assert.equal((await f.request(path + "/approve", "post", { revision: saved.data.revision }, admin)).status, 409);
  assert.equal(f.state.org.payoutManualApproved, false);
  assert.equal(f.state.audits.length, 0);
  f.state.failAudit = false;
  const envelope = f.state.record.encrypted;
  f.state.record.encrypted = "invalid";
  assert.equal((await f.request(path + "/status", "get", {}, admin)).status, 200);
  assert.equal((await f.request(path, "get", {}, admin)).status, 503);
  assert.equal(f.state.audits.length, 0);
  f.state.record.encrypted = envelope;
  await f.request(path, "get", {}, admin);
  await f.request(path, "get", {}, admin);
  assert.equal(f.state.audits.length, 2, "each repeated reveal must be audited");
});

test("save failures preserve the previous record and block changes while a settlement is locked", async () => {
  const f = await fixture(), owner = { authorization: "Bearer owner" };
  await f.request("/payout/bank-details", "put", input, owner);
  const before = structuredClone(f.state.record);
  f.state.org.payoutSettlementBatchId = "synthetic-batch";
  assert.equal((await f.request("/payout/bank-details", "put", input, owner)).status, 503);
  assert.deepEqual(f.state.record, before);
  delete f.state.org.payoutSettlementBatchId;
  f.state.fail = true;
  const failed = await f.request("/payout/bank-details", "put", input, owner);
  assert.equal(failed.status, 503);
  assert.deepEqual(f.state.record, before);
  assert.doesNotMatch(JSON.stringify(failed), /Private provider payload/);
});

test("real Firestore adapter commits revocation and encrypted bank record atomically and retries conflicts", async () => {
  const previousFetch = globalThis.fetch;
  const commits: any[] = [];
  let reads = 0;
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith(":commit")) {
        commits.push(JSON.parse(String(options?.body)));
        return commits.length === 1 ? new Response("conflict", { status: 409 }) : new Response("{}");
      }
      reads++;
      return String(url).includes("/organisation_bank_details/") ? new Response("", { status: 404 })
        : new Response(JSON.stringify({ updateTime: `snapshot-${reads}`, fields: { payoutManualApproved: { booleanValue: true } } }));
    };
    const result = await fsMutateBankDetails("synthetic-org", "synthetic-token", () => ({
      orgUpdates: { payoutManualApproved: false, bankDetailsRevision: "revision" },
      record: { encrypted: syntheticEnvelope(), revision: "revision", submittedAt: new Date().toISOString() }, result: "saved",
    }));
    assert.equal(result, "saved"); assert.equal(commits.length, 2);
    assert.equal(commits[1].writes.length, 2);
    assert.equal(commits[1].writes[0].update.fields.payoutManualApproved.booleanValue, false);
    assert.equal(commits[1].writes[1].currentDocument.exists, false);
    assert.ok(commits[1].writes[0].currentDocument.updateTime);
  } finally { globalThis.fetch = previousFetch; }
});

function syntheticEnvelope() {
  return ["v2", "primary", Buffer.alloc(12, 1).toString("base64"), Buffer.alloc(16, 2).toString("base64"),
    Buffer.from("synthetic encrypted bytes").toString("base64")].join(".");
}

test("storage rejects missing/malformed envelopes and plaintext side fields before any commit", async () => {
  const previousFetch = globalThis.fetch;
  let writes = 0;
  try {
    globalThis.fetch = async (url, options) => {
      if (options?.method === "POST") { writes++; return new Response("{}"); }
      return String(url).includes("/organisation_bank_details/") ? new Response("", { status: 404 })
        : new Response(JSON.stringify({ updateTime: "snapshot", fields: {} }));
    };
    for (const invalid of [
      {}, { encrypted: input.accountNumber }, { encrypted: "v1.bad.bad.bad" },
      { encrypted: syntheticEnvelope(), accountNumber: input.accountNumber },
      { encrypted: syntheticEnvelope().replace("v2.primary", "v9.primary") },
    ]) {
      await assert.rejects(fsMutateBankDetails("org", "token", () => ({
        orgUpdates: {}, record: { revision: "r", submittedAt: new Date().toISOString(), ...invalid }, result: null,
      })), /Invalid encrypted bank record/);
    }
    assert.equal(writes, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test("approval and create-only audit are in the same Firestore commit; denied audit cannot approve", async () => {
  const previousFetch = globalThis.fetch, commits: any[] = [];
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith(":commit")) {
        commits.push(JSON.parse(String(options?.body)));
        return new Response("Permission denied", { status: 403 });
      }
      const fields = String(url).includes("/organisation_bank_details/") ? {
        encrypted: { stringValue: syntheticEnvelope() }, revision: { stringValue: "r" },
        submittedAt: { stringValue: new Date().toISOString() },
      } : {};
      return new Response(JSON.stringify({ updateTime: "snapshot", fields }));
    };
    await assert.rejects(fsMutateBankDetails("org", "token", () => ({
      orgUpdates: { payoutManualApproved: true }, result: null,
    })), /requires a matching audit/);
    assert.equal(commits.length, 0);
    const audit = bankAudit("approve", "org", "r");
    await assert.rejects(fsMutateBankDetails("org", "token", () => ({
      orgUpdates: { payoutManualApproved: true }, result: null,
    }), audit), /Could not save/);
    assert.equal(commits.length, 1);
    const writes = commits[0].writes;
    assert.equal(writes.length, 3);
    assert.equal(writes[2].currentDocument.exists, false);
    assert.ok(writes[2].update.name.endsWith(`/bank_details_audit/${audit.id}`));
    assert.equal(writes[2].update.fields.revision.stringValue, "r");
  } finally { globalThis.fetch = previousFetch; }
});

test("administrator banking access has no built-in credential fallback", async () => {
  for (const configured of [false, true]) {
    const compiled = await build({
      stdin: { contents: 'export {requireAdmin,getAdminTokenValue} from "./admin-auth.ts";',
        resolveDir: new URL(".", import.meta.url).pathname },
      bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
      define: { "process.env.ADMIN_PASSWORD": '""',
        "process.env.ADMIN_SECRET": JSON.stringify(configured ? "synthetic-admin-secret" : "") },
    });
    const mod = { exports: {} as any };
    new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
    const { requireAdmin, getAdminTokenValue } = mod.exports;
    let status = 200, allowed = false;
    const res = { status(code: number) { status = code; return this; }, json() {} };
    if (configured) {
      requireAdmin({ headers: { "x-admin-token": getAdminTokenValue() } }, res, () => { allowed = true; });
      assert.equal(allowed, true);
    } else {
      assert.throws(() => getAdminTokenValue(), /not configured/);
      requireAdmin({ headers: {} }, res, () => { allowed = true; });
      assert.equal(status, 503); assert.equal(allowed, false);
    }
  }
});
