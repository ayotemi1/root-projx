import { assertEncryptedBankRecord } from "./bank-envelope.ts";
import { BANK_AUDIT_COLLECTION, type BankAudit } from "./bank-audit.ts";

const API_KEY = process.env.FIREBASE_API_KEY!;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;
const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Server-side token cache — used for server-initiated Firestore reads (no user token available)
// SECURITY: the server password must come from the environment. Never hardcode a
// fallback here — a committed password grants full database access to anyone
// who has ever read this repository.
const SERVER_EMAIL = process.env.FIREBASE_SERVER_EMAIL ?? "seeder@rootprojx.internal";
const SERVER_PASS = process.env.FIREBASE_SERVER_PASSWORD;
let _serverToken: string | null = null;
let _serverTokenExpiry = 0;

export async function getServerToken(): Promise<string> {
  if (!SERVER_PASS) {
    throw new Error(
      "FIREBASE_SERVER_PASSWORD is not set. Privileged Firestore operations are disabled until it is configured in Replit Secrets.",
    );
  }
  if (_serverToken && Date.now() < _serverTokenExpiry) return _serverToken;
  const res = await fetch(`${IDENTITY}:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SERVER_EMAIL, password: SERVER_PASS, returnSecureToken: true }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error("Server token refresh failed");
  _serverToken = data.idToken as string;
  _serverTokenExpiry = Date.now() + 55 * 60 * 1000; // refresh 5 min before 1-hour expiry
  return _serverToken;
}

// ─── Firebase Auth REST ───────────────────────────────────────────────────────

export async function firebaseSignUp(email: string, password: string) {
  const res = await fetch(`${IDENTITY}:signUp?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const code = ((data.error as Record<string, unknown>)?.message as string) ?? "SIGNUP_FAILED";
    throw Object.assign(new Error(code), { firebaseCode: code });
  }
  return { idToken: data.idToken as string, uid: data.localId as string };
}

export async function firebaseSignIn(email: string, password: string) {
  const res = await fetch(`${IDENTITY}:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const code = ((data.error as Record<string, unknown>)?.message as string) ?? "SIGNIN_FAILED";
    throw Object.assign(new Error(code), { firebaseCode: code });
  }
  return { idToken: data.idToken as string, uid: data.localId as string };
}

export async function firebaseLookup(idToken: string): Promise<{ uid: string; email: string } | null> {
  const res = await fetch(`${IDENTITY}:lookup?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  const data = await res.json() as Record<string, unknown>;
  const users = data.users as Record<string, unknown>[] | undefined;
  const user = users?.[0];
  if (!user) return null;
  return { uid: user.localId as string, email: user.email as string };
}

export async function firebaseUpdateProfile(idToken: string, displayName: string) {
  await fetch(`${IDENTITY}:update?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, displayName }),
  });
}

export async function firebaseSendPasswordResetEmail(email: string): Promise<void> {
  const res = await fetch(`${IDENTITY}:sendOobCode?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
  });
  if (!res.ok) {
    const data = await res.json() as Record<string, unknown>;
    const code = ((data.error as Record<string, unknown>)?.message as string) ?? "PASSWORD_RESET_FAILED";
    throw Object.assign(new Error(code), { firebaseCode: code });
  }
}

// Firebase validates expiry/single-use and enforces its password policy.
// Never log the code, password or Firebase response (which can contain email).
export async function firebaseResetPassword(oobCode: string, newPassword?: string): Promise<void> {
  const res = await fetch(`${IDENTITY}:resetPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oobCode, ...(newPassword !== undefined ? { newPassword } : {}) }),
  });
  if (!res.ok) {
    const data = await res.json() as Record<string, unknown>;
    const code = ((data.error as Record<string, unknown>)?.message as string) ?? "PASSWORD_RESET_FAILED";
    throw Object.assign(new Error("Password reset failed"), { firebaseCode: code.split(" : ")[0] });
  }
}

// ─── Firestore REST ───────────────────────────────────────────────────────────

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields: Record<string, FsValue> } };

function toFsVal(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsVal) } };
  if (typeof v === "object") {
    const fields: Record<string, FsValue> = {};
    for (const [k, fv] of Object.entries(v as Record<string, unknown>)) {
      fields[k] = toFsVal(fv);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromFsVal(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(fromFsVal);
  if ("mapValue" in v) {
    const res: Record<string, unknown> = {};
    for (const [k, fv] of Object.entries(v.mapValue.fields)) res[k] = fromFsVal(fv);
    return res;
  }
  return null;
}

function fromFsDoc(fields: Record<string, FsValue>): Record<string, unknown> {
  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) res[k] = fromFsVal(v);
  return res;
}

export async function fsGet(
  collection: string,
  docId: string,
  idToken?: string,
  opts?: { includeDeleted?: boolean },
): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = {};
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch(`${FIRESTORE}/${collection}/${docId}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore GET ${collection}/${docId} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  const doc = await res.json() as { fields?: Record<string, FsValue> };
  const data = fromFsDoc(doc.fields ?? {});
  // Deleted organisations remain stored for settlement and financial history,
  // but ordinary public, owner and checkout reads must treat them as absent.
  if (collection === "organisations" && data.deletedAt && !opts?.includeDeleted) return null;
  return data;
}

// Atomic create-only write: retries/concurrent deliveries cannot overwrite a
// ledger row that has already been settled.
export async function fsCreateIfAbsent(
  collection: string, docId: string, data: Record<string, unknown>, idToken: string,
): Promise<boolean> {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsVal(v)]));
  const res = await fetch(`${FIRESTORE}/${collection}?documentId=${encodeURIComponent(docId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields }),
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`Firestore create-only ${collection} failed ${res.status}`);
  return true;
}

// Cross-process settlement mutex. Never expires automatically: an interrupted
// transfer must be reconciled before another run may send more money.
export async function fsTrySettlementLock(orgId: string, batchId: string, token: string): Promise<boolean> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const response = await fetch(`${FIRESTORE}/organisations/${encodeURIComponent(orgId)}`, { headers });
  if (!response.ok) throw new Error("Cannot load organisation for settlement lock");
  const doc = await response.json() as { name: string; updateTime: string; fields: Record<string, FsValue> };
  if (fromFsVal(doc.fields.payoutSettlementBatchId ?? { nullValue: null })) return false;
  const result = await fetch(`${FIRESTORE}:commit`, { method: "POST", headers, body: JSON.stringify({
    writes: [{ update: { name: doc.name, fields: { payoutSettlementBatchId: { stringValue: batchId } } },
      updateMask: { fieldPaths: ["payoutSettlementBatchId"] }, currentDocument: { updateTime: doc.updateTime } }],
  }) });
  if (result.status === 409 || result.status === 400 && (await result.clone().text()).includes("FAILED_PRECONDITION")) return false;
  if (!result.ok) throw new Error(`Cannot acquire settlement lock (${result.status})`);
  return true;
}

export async function fsReleaseSettlementLock(orgId: string, token: string): Promise<void> {
  const response = await fetch(`${FIRESTORE}:commit`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ writes: [{
      update: { name: `projects/${PROJECT_ID}/databases/(default)/documents/organisations/${orgId}`,
        fields: { payoutSettlementBatchId: { nullValue: null } } },
      updateMask: { fieldPaths: ["payoutSettlementBatchId"] }, currentDocument: { exists: true },
    }] }),
  });
  if (!response.ok) throw new Error("Could not release settlement lock; reconcile before retrying");
}

/** Compare-and-swap the embedded campaign array; preserve concurrent donation
 * totals, other campaigns, and every non-campaign organisation field. */
export async function fsMutateCampaigns<T>(
  orgId: string, token: string,
  mutate: (org: Record<string, unknown>) => { campaigns: Record<string, unknown>[]; result: T },
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`${FIRESTORE}/organisations/${encodeURIComponent(orgId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Could not load the latest campaign draft. Retry saving.");
    const doc = await response.json() as { name: string; fields: Record<string, FsValue>; updateTime: string };
    const { campaigns, result } = mutate(fromFsDoc(doc.fields ?? {}));
    const saved = await fetch(`${FIRESTORE}:commit`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ writes: [{
        update: { name: doc.name, fields: { campaigns: toFsVal(campaigns) } },
        updateMask: { fieldPaths: ["campaigns"] }, currentDocument: { updateTime: doc.updateTime },
      }] }),
    });
    if (saved.ok) return result;
    const error = await saved.text();
    if (saved.status === 409 || (saved.status === 400 && /FAILED_PRECONDITION/.test(error))) continue;
    throw new Error("Your campaign was not saved. Keep this page open and retry.");
  }
  throw new Error("Your organisation changed while saving. Your draft is kept; retry saving.");
}

/** Bank edits and approval share a two-document compare-and-swap. A stale
 * admin review cannot approve changed details, and edits cannot race a payout. */
export async function fsMutateBankDetails<T>(
  orgId: string, token: string,
  mutate: (org: Record<string, unknown>, record: Record<string, unknown> | null) => {
    orgUpdates: Record<string, unknown>; record?: Record<string, unknown>; result: T;
  },
  approvalAudit?: BankAudit,
): Promise<T> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const name = `projects/${PROJECT_ID}/databases/(default)/documents`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [orgRes, bankRes] = await Promise.all([
      fetch(`${FIRESTORE}/organisations/${encodeURIComponent(orgId)}`, { headers }),
      fetch(`${FIRESTORE}/organisation_bank_details/${encodeURIComponent(orgId)}`, { headers }),
    ]);
    if (!orgRes.ok || (!bankRes.ok && bankRes.status !== 404)) throw new Error("Cannot load private bank record.");
    const orgDoc = await orgRes.json() as { fields: Record<string, FsValue>; updateTime: string };
    const bankDoc = bankRes.ok ? await bankRes.json() as { fields: Record<string, FsValue>; updateTime: string } : null;
    const org = fromFsDoc(orgDoc.fields ?? {});
    if (org.deletedAt) throw new Error("Organisation not found.");
    const bank = bankDoc ? fromFsDoc(bankDoc.fields ?? {}) : null;
    const mutation = mutate(org, bank);
    const record = mutation.record ?? bank;
    if (!record) throw new Error("Submit bank details before approval.");
    assertEncryptedBankRecord(record);
    if (mutation.orgUpdates.payoutManualApproved === true &&
        (!approvalAudit || approvalAudit.record.action !== "approve" ||
          approvalAudit.record.orgId !== orgId || approvalAudit.record.revision !== record.revision)) {
      throw new Error("Bank approval requires a matching audit record.");
    }
    const writes = [{
      update: { name: `${name}/organisations/${orgId}`,
        fields: Object.fromEntries(Object.entries(mutation.orgUpdates).map(([k, v]) => [k, toFsVal(v)])) },
      updateMask: { fieldPaths: Object.keys(mutation.orgUpdates) },
      currentDocument: { updateTime: orgDoc.updateTime },
    }, {
      update: { name: `${name}/organisation_bank_details/${orgId}`,
        fields: Object.fromEntries(Object.entries(record).map(([k, v]) => [k, toFsVal(v)])) },
      currentDocument: bankDoc ? { updateTime: bankDoc.updateTime } : { exists: false },
    }];
    if (approvalAudit) {
      writes.push({
        update: { name: `${name}/${BANK_AUDIT_COLLECTION}/${approvalAudit.id}`,
          fields: Object.fromEntries(Object.entries(approvalAudit.record).map(([k, v]) => [k, toFsVal(v)])) },
        currentDocument: { exists: false },
      });
    }
    const saved = await fetch(`${FIRESTORE}:commit`, { method: "POST", headers, body: JSON.stringify({ writes }) });
    if (saved.ok) return mutation.result;
    const error = await saved.text();
    if (saved.status === 409 || saved.status === 400 && error.includes("FAILED_PRECONDITION")) continue;
    throw new Error("Could not save private bank record.");
  }
  throw new Error("Bank details changed while saving. Reload and review again.");
}

export async function fsPatch(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
  idToken?: string,
): Promise<void> {
  // Some legacy callers still pass a whole org snapshot. They must never clear
  // or restore a stale settlement lock. Only the dedicated atomic helpers own it.
  const updates = collection === "organisations"
    ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== "payoutSettlementBatchId"))
    : data;
  if (Object.keys(updates).length === 0) return;
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(updates)) fields[k] = toFsVal(v);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

  const updateMask = new URLSearchParams();
  for (const field of Object.keys(updates)) updateMask.append("updateMask.fieldPaths", field);
  const query = updateMask.toString();
  const res = await fetch(`${FIRESTORE}/${collection}/${docId}${query ? `?${query}` : ""}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore PATCH ${collection}/${docId} failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function fsQuery(
  collection: string,
  filters: Array<{ field: string; op: string; value: unknown }>,
  idToken?: string,
  opts?: { orderBy?: { field: string; dir?: "ASCENDING" | "DESCENDING" }; limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const where =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? {
            fieldFilter: {
              field: { fieldPath: filters[0]!.field },
              op: filters[0]!.op,
              value: toFsVal(filters[0]!.value),
            },
          }
        : {
            compositeFilter: {
              op: "AND",
              filters: filters.map((f) => ({
                fieldFilter: {
                  field: { fieldPath: f.field },
                  op: f.op,
                  value: toFsVal(f.value),
                },
              })),
            },
          };

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collection }],
    ...(where ? { where } : {}),
    ...(opts?.orderBy
      ? { orderBy: [{ field: { fieldPath: opts.orderBy.field }, direction: opts.orderBy.dir ?? "DESCENDING" }] }
      : {}),
    ...(opts?.limit ? { limit: opts.limit } : {}),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    { method: "POST", headers, body: JSON.stringify({ structuredQuery }) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore query failed ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = await res.json() as Array<{ document?: { fields?: Record<string, FsValue>; name?: string } }>;
  return rows
    .filter((r) => r.document?.fields)
    .map((r) => ({
      _id: r.document!.name?.split("/").pop() ?? "",
      ...fromFsDoc(r.document!.fields!),
    }))
    .filter((doc) => collection !== "organisations" || !(doc as Record<string, unknown>).deletedAt);
}

export async function fsList(
  collection: string,
  idToken?: string,
  pageSize = 100,
): Promise<Array<Record<string, unknown>>> {
  const headers: Record<string, string> = {};
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch(`${FIRESTORE}/${collection}?pageSize=${pageSize}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore LIST ${collection} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json() as { documents?: Array<{ fields?: Record<string, FsValue>; name?: string }> };
  return (body.documents ?? []).map((d) => ({
    _id: d.name?.split("/").pop() ?? "",
    ...fromFsDoc(d.fields ?? {}),
  })).filter((doc) => collection !== "organisations" || !(doc as Record<string, unknown>).deletedAt);
}

export async function fsDelete(
  collection: string,
  docId: string,
  idToken?: string,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch(`${FIRESTORE}/${collection}/${docId}`, { method: "DELETE", headers });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Firestore DELETE ${collection}/${docId} failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

// Atomically increment one or more numeric fields on a document using Firestore's
// server-side `increment` transform. Unlike read-modify-write (fsGet + fsPatch),
// this is safe under concurrency: two simultaneous donations both land correctly,
// and no other fields on the document are touched or overwritten.
export async function fsIncrement(
  collection: string,
  docId: string,
  increments: Record<string, number>,
  idToken?: string,
): Promise<void> {
  const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const fieldTransforms = Object.entries(increments).map(([fieldPath, amount]) => ({
    fieldPath,
    increment: Number.isInteger(amount)
      ? { integerValue: String(amount) }
      : { doubleValue: amount },
  }));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        writes: [
          {
            transform: { document: docPath, fieldTransforms },
            // Only apply to existing documents — never create a phantom org/user
            // doc as a side effect of an increment.
            currentDocument: { exists: true },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore INCREMENT ${collection}/${docId} failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

/** Supporter publication is one atomic commit: a post cannot become visible
 * before all its owned, verified media are attached, nor can concurrent posts
 * claim the same upload. Preconditions protect against cross-process races. */
export async function fsCompleteSupporterMedia(
  id: string, ready: Record<string, unknown>, token: string,
): Promise<Record<string, unknown>> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const url = `${FIRESTORE}/supporter_post_media/${id}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const read = await fetch(url, { headers });
    if (!read.ok) throw new Error("Supporter upload is unavailable");
    const doc = await read.json() as { fields: Record<string, FsValue>; updateTime: string };
    const current = fromFsDoc(doc.fields);
    if (current.author_id !== ready.author_id || current.objectPath !== ready.objectPath)
      throw new Error("Supporter upload owner mismatch");
    if (current.state === "ready") return current;
    const fields = Object.fromEntries(Object.entries(ready).map(([k, v]) => [k, toFsVal(v)]));
    const write = await fetch(`${url}?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`, {
      method: "PATCH", headers, body: JSON.stringify({ fields }),
    });
    if (write.ok) return ready;
    if (![409, 412].includes(write.status)) throw new Error("Could not verify supporter media");
  }
  throw new Error("Supporter upload changed during completion");
}

export async function fsPublishSupporterPost(
  post: Record<string, unknown>,
  edits: Array<Record<string, unknown>>,
  token: string,
): Promise<void> {
  const id = String(post.id);
  const author = String(post.author_id);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const base = `projects/${PROJECT_ID}/databases/(default)/documents`;
  const fields = (data: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsVal(v)]));
  const writes: Record<string, unknown>[] = [{
    update: { name: `${base}/supporter_posts/${id}`, fields: fields(post) },
    currentDocument: { exists: false },
  }];
  for (const edit of edits) {
    const response = await fetch(`${FIRESTORE}/supporter_post_media/${edit.id}`, { headers });
    if (!response.ok) throw new Error("Supporter media is unavailable");
    const doc = await response.json() as { fields: Record<string, FsValue>; updateTime: string };
    const media = fromFsDoc(doc.fields);
    if (media.author_id !== author || media.state !== "ready" || media.post_id)
      throw new Error("Supporter media cannot be attached");
    const data = { post_id: id, order: edit.order, crop: edit.crop, filter: edit.filter, adjustments: edit.adjustments };
    writes.push({
      update: { name: `${base}/supporter_post_media/${edit.id}`, fields: fields(data) },
      updateMask: { fieldPaths: Object.keys(data) },
      currentDocument: { updateTime: doc.updateTime },
    });
  }
  const response = await fetch(`${FIRESTORE}:commit`, {
    method: "POST", headers, body: JSON.stringify({ writes }),
  });
  if (!response.ok) throw new Error(`Supporter publication commit failed ${response.status}`);
}

export async function fsCreate(
  collection: string,
  data: Record<string, unknown>,
  idToken?: string,
): Promise<string> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFsVal(v);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch(`${FIRESTORE}/${collection}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore POST ${collection} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  const doc = await res.json() as { name?: string };
  return doc.name?.split("/").pop() ?? "";
}
