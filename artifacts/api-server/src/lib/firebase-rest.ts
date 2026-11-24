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
  | { mapValue: { fields?: Record<string, FsValue> } };

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
    // Firestore REST omits fields for a valid empty map, including nested maps.
    for (const [k, fv] of Object.entries(v.mapValue.fields ?? {})) res[k] = fromFsVal(fv);
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

/** Private email-only compare-and-write. Never broaden this to arbitrary
 * caller-selected collections. The server rules must be manually published
 * before enabling the email rollout. Fail without exposing a provider payload. */
export async function fsMutateEmailState<T>(
  collection: "email_outbox" | "email_preferences" | "email_settings" | "email_invitations" | "email_events",
  id: string,
  token: string,
  decide: (current: Record<string, unknown> | null) => { patch?: Record<string, unknown>; result: T },
): Promise<T> {
  if (!["email_outbox", "email_preferences", "email_settings", "email_invitations", "email_events"].includes(collection) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid private email record.");
  return fsCompareAndPatch(collection, id, token, decide);
}
export async function fsMutateApplicationState<T>(
  id: string, token: string,
  decide: (current: Record<string, unknown> | null) => { patch?: Record<string, unknown>; result: T },
): Promise<T> {
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new Error("Invalid application.");
  return fsCompareAndPatch("org_applications", id, token, decide);
}
async function fsCompareAndPatch<T>(
  collection: string, id: string, token: string,
  decide: (current: Record<string, unknown> | null) => { patch?: Record<string, unknown>; result: T },
): Promise<T> {
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const name = `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${id}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(`${FIRESTORE}/${collection}/${id}`, { headers: authHeaders });
    if (!response.ok && response.status !== 404) throw new Error("Could not load private email record.");
    const raw = response.status === 404 ? null : await response.json() as { fields?: Record<string, FsValue>; updateTime: string };
    if (raw && typeof raw.updateTime !== "string") throw new Error("Invalid private email version.");
    const decision = decide(raw ? fromFsDoc(raw.fields ?? {}) : null);
    if (!decision.patch || !Object.keys(decision.patch).length) return decision.result;
    const saved = await fetch(`${FIRESTORE}:commit`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({ writes: [{
        update: { name, fields: Object.fromEntries(Object.entries(decision.patch).map(([k, v]) => [k, toFsVal(v)])) },
        updateMask: { fieldPaths: Object.keys(decision.patch) },
        currentDocument: raw ? { updateTime: raw.updateTime } : { exists: false },
      }] }),
    });
    if (saved.ok) return decision.result;
    if (saved.status === 409 ||
        saved.status === 400 && (await saved.clone().text()).includes("FAILED_PRECONDITION")) continue;
    throw new Error("Could not save private email record.");
  }
  throw new Error("Private email record changed. Please retry.");
}

/** Approval changes the account role, initial public profile and application
 * together. A concurrent decline cannot leave an approved account behind. */
export async function fsApproveOrganisationApplication(
  applicationId: string, uid: string, orgData: Record<string, unknown>, userData: Record<string, unknown>,
  approval: Record<string, unknown>, token: string,
): Promise<Record<string, unknown>> {
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(applicationId) || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("Invalid approval identity.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const root = `projects/${PROJECT_ID}/databases/(default)/documents`;
  async function read(path: string) {
    const r = await fetch(`${FIRESTORE}/${path}`, { headers });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("Application approval could not be checked.");
    const raw = await r.json() as { fields?: Record<string, FsValue>; updateTime: string };
    return { name: `${root}/${path}`, raw, data: fromFsDoc(raw.fields ?? {}) };
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const [app, user, org] = await Promise.all([
      read(`org_applications/${applicationId}`), read(`users/${uid}`), read(`organisations/${uid}`),
    ]);
    if (!app || app.data.uid !== uid || user?.data.deletedAt || user && user.data.accountType !== "organisation" || org?.data.deletedAt) {
      throw new Error("Application account cannot be approved.");
    }
    if (app.data.status === "approved") return { ...app.data, _id: applicationId };
    if (!["pending", "waiting"].includes(String(app.data.status))) throw new Error("Application is no longer awaiting approval.");
    const update = (name: string, fields: Record<string, unknown>, version: string | null) => ({
      update: { name, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toFsVal(v)])) },
      updateMask: { fieldPaths: Object.keys(fields) },
      currentDocument: version ? { updateTime: version } : { exists: false },
    });
    const saved = await fetch(`${FIRESTORE}:commit`, {
      method: "POST", headers,
      body: JSON.stringify({ writes: [
        org ? { verify: org.name, currentDocument: { updateTime: org.raw.updateTime } }
          : update(`${root}/organisations/${uid}`, orgData, null),
        update(`${root}/users/${uid}`, userData, user?.raw.updateTime ?? null),
        update(app.name, approval, app.raw.updateTime),
      ] }),
    });
    if (saved.ok) return { ...app.data, ...approval, _id: applicationId };
    if (saved.status === 409 || saved.status === 400 && (await saved.text()).includes("FAILED_PRECONDITION")) continue;
    throw new Error("Application approval could not be saved.");
  }
  throw new Error("Application changed during approval. Refresh before retrying.");
}

/** Consume the mailbox-delivered invitation and establish its limited grant in
 * one commit. Retrying a consumed invitation cannot restore a revoked grant. */
export async function fsAcceptEmailInvitation(invitationId: string, userId: string, recipientDigest: string, token: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(invitationId) || !/^[a-f0-9]{64}$/.test(recipientDigest) || !/^[A-Za-z0-9_-]{1,128}$/.test(userId)) throw new Error("Invalid invitation.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const root = `projects/${PROJECT_ID}/databases/(default)/documents`;
  async function read(path: string) {
    const response = await fetch(`${FIRESTORE}/${path}`, { headers });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Invitation access could not be checked.");
    const raw = await response.json() as { fields?: Record<string, FsValue>; updateTime: string };
    return { raw, data: fromFsDoc(raw.fields ?? {}), name: `${root}/${path}` };
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const invite = await read(`email_invitations/${invitationId}`);
    if (!invite || invite.data.recipientDigest !== recipientDigest ||
        typeof invite.data.orgId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(invite.data.orgId)) throw new Error("Sign in with the account invited by email.");
    if (invite.data.status === "accepted" && invite.data.acceptedBy === userId) return;
    if (invite.data.status !== "pending" || !Number.isFinite(Date.parse(String(invite.data.expiresAt))) ||
        Date.parse(String(invite.data.expiresAt)) <= Date.now()) throw new Error("This invitation is no longer valid. Ask for a new invitation.");
    const orgId = invite.data.orgId;
    const [org, owner, actor, access] = await Promise.all([
      read(`organisations/${orgId}`), read(`users/${orgId}`), read(`users/${userId}`),
      read(`organisation_messaging_access/${orgId}`),
    ]);
    if (orgId === userId || !org || org.data.deletedAt || !owner || owner.data.deletedAt ||
        owner.data.accountType !== "organisation" || ["pending", "declined"].includes(String(owner.data.approvalStatus)) ||
        !actor || actor.data.deletedAt || !["supporter", "organisation"].includes(String(actor.data.accountType)) ||
        actor.data.accountType === "organisation" && actor.data.approvalStatus != null && actor.data.approvalStatus !== "approved") throw new Error("This account cannot accept the invitation.");
    const ids = new Set(Array.isArray(access?.data.managerIds) ? access!.data.managerIds.filter((v): v is string => typeof v === "string") : []);
    ids.add(userId);
    if (ids.size > 25) throw new Error("This organisation already has 25 managers.");
    const now = new Date().toISOString();
    const save = await fetch(`${FIRESTORE}:commit`, {
      method: "POST", headers,
      body: JSON.stringify({ writes: [
        ...[org, owner, actor].map(document => ({ verify: document.name, currentDocument: { updateTime: document.raw.updateTime } })),
        {
          update: { name: `${root}/organisation_messaging_access/${orgId}`, fields: {
            managerIds: toFsVal([...ids]), updatedAt: toFsVal(now), updatedBy: toFsVal(orgId),
          } },
          updateMask: { fieldPaths: ["managerIds", "updatedAt", "updatedBy"] },
          currentDocument: access ? { updateTime: access.raw.updateTime } : { exists: false },
        },
        {
          update: { name: invite.name, fields: { status: toFsVal("accepted"), acceptedAt: toFsVal(now), acceptedBy: toFsVal(userId) } },
          updateMask: { fieldPaths: ["status", "acceptedAt", "acceptedBy"] }, currentDocument: { updateTime: invite.raw.updateTime },
        },
      ] }),
    });
    if (save.ok) return;
    if (save.status === 409 || save.status === 400 && (await save.text()).includes("FAILED_PRECONDITION")) continue;
    throw new Error("Invitation could not be accepted. Please retry.");
  }
  throw new Error("The team changed while accepting. Please retry.");
}

/** Bounded messaging-only compare-and-write. A message and its counters commit
 * together; a lost response can safely be retried with the same message ID. */
export async function fsMutateMessaging<T>(
  collection: "conversations" | "organisation_messaging_access",
  id: string,
  token: string,
  decide: (current: Record<string, unknown> | null, existingMessage: Record<string, unknown> | null) =>
    { patch?: Record<string, unknown>; message?: Record<string, unknown>; result: T },
  messageId?: string,
): Promise<T> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || messageId && !/^m_[A-Za-z0-9_-]{43}$/.test(messageId)) throw new Error("Invalid messaging record.");
  if (collection !== "conversations" && collection !== "organisation_messaging_access") throw new Error("Invalid messaging collection.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const name = `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${id}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(`${FIRESTORE}/${collection}/${id}`, { headers });
    if (!response.ok && response.status !== 404) throw new Error("Could not load private messaging record.");
    const raw = response.status === 404 ? null : await response.json() as { fields: Record<string, FsValue>; updateTime: string };
    if (raw && typeof raw.updateTime !== "string") throw new Error("Invalid messaging record version.");
    const existing = messageId ? await fsGet("conversation_messages", messageId, token) : null;
    const decision = decide(raw ? fromFsDoc(raw.fields ?? {}) : null, existing);
    const writes: Record<string, unknown>[] = [];
    if (decision.patch && Object.keys(decision.patch).length) {
      writes.push({
        update: { name, fields: Object.fromEntries(Object.entries(decision.patch).map(([k, v]) => [k, toFsVal(v)])) },
        updateMask: { fieldPaths: Object.keys(decision.patch) },
        currentDocument: raw ? { updateTime: raw.updateTime } : { exists: false },
      });
    }
    if (decision.message) {
      if (!messageId || collection !== "conversations") throw new Error("Invalid message write.");
      writes.push({
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/conversation_messages/${messageId}`,
          fields: Object.fromEntries(Object.entries(decision.message).map(([k, v]) => [k, toFsVal(v)])),
        },
        currentDocument: { exists: false },
      });
    }
    if (!writes.length) return decision.result;
    const saved = await fetch(`${FIRESTORE}:commit`, { method: "POST", headers, body: JSON.stringify({ writes }) });
    if (saved.ok) return decision.result;
    if (saved.status === 409 || saved.status === 400 && (await saved.clone().text()).includes("FAILED_PRECONDITION")) continue;
    throw new Error("Could not save private messaging record.");
  }
  throw new Error("Conversation changed while saving. Please retry.");
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

/** Compare-and-write only the supporter's showcase field, preserving all
 * account, interests, giving and concurrent profile edits. Retried decisions
 * must be pure; caller supplies stable entry IDs for response-loss retries. */
export async function fsMutateSupporterShowcase(
  uid: string, token: string,
  decide: (user: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("Invalid profile");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(`${FIRESTORE}/users/${uid}`, { headers });
    if (!response.ok) throw new Error("Profile could not be loaded");
    const raw = await response.json() as { fields: Record<string, FsValue>; updateTime: string };
    if (typeof raw.updateTime !== "string") throw new Error("Invalid profile version");
    const showcase = decide(fromFsDoc(raw.fields ?? {}));
    const params = new URLSearchParams({ "updateMask.fieldPaths": "profileShowcase", "currentDocument.updateTime": raw.updateTime });
    const saved = await fetch(`${FIRESTORE}/users/${uid}?${params}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ fields: { profileShowcase: toFsVal(showcase) } }),
    });
    if (saved.ok) return;
    if (saved.status === 409 || saved.status === 412 ||
        saved.status === 400 && (await saved.text()).includes("FAILED_PRECONDITION")) continue;
    throw new Error("Profile could not be saved");
  }
  throw new Error("Profile changed while saving");
}

/** Account presentation/preferences only. Compare-and-write prevents a profile
 * save, autosaved setting and bookmark/involvement change overwriting each other.
 * No role, approval, email or financial fields can be written through this API. */
export async function fsMutateSupporterAccount(
  uid: string, token: string,
  decide: (user: Record<string, unknown>) => Record<string, unknown>,
  allowOrganisationPreferences = false,
): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("Invalid account");
  const allowed = new Set(["name", "avatarInitials", "avatarUrl", "avatarPhotoId", "publicProfile", "profileShowcase", "notificationDelivery"]);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(`${FIRESTORE}/users/${uid}`, { headers });
    if (!response.ok) throw new Error("Account could not be loaded");
    const raw = await response.json() as { fields: Record<string, FsValue>; updateTime: string };
    if (typeof raw.updateTime !== "string") throw new Error("Invalid account version");
    const user = fromFsDoc(raw.fields ?? {});
    const organisation = user.accountType === "organisation" && allowOrganisationPreferences;
    if (user.accountType !== "supporter" && !organisation) throw new Error("Account is not a supporter");
    const patch = decide(user);
    const keys = Object.keys(patch);
    if (!keys.length) return;
    if (keys.some(k => !allowed.has(k))) throw new Error("Invalid account field");
    if (organisation && keys.some(k => !["profileShowcase", "notificationDelivery"].includes(k)))
      throw new Error("Only organisation preferences can be changed here");
    const params = new URLSearchParams({ "currentDocument.updateTime": raw.updateTime });
    for (const key of keys) params.append("updateMask.fieldPaths", key);
    const saved = await fetch(`${FIRESTORE}/users/${uid}?${params}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ fields: Object.fromEntries(keys.map(k => [k, toFsVal(patch[k])])) }),
    });
    if (saved.ok) return;
    if ([409, 412].includes(saved.status)) continue;
    throw new Error("Account could not be saved");
  }
  throw new Error("Account changed; retry");
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
// Atomic append-only set membership: two tabs opening different notifications
// cannot overwrite each other's read state or any unrelated account fields.
export async function fsMarkSupporterNotificationRead(uid: string, id: string, token: string): Promise<void> {
  if (!uid || uid.includes("/") || !/^n_[A-Za-z0-9_-]{32}$/.test(id)) throw new Error("Invalid notification read");
  const document = `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const response = await fetch(`${FIRESTORE}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ writes: [{
      transform: { document, fieldTransforms: [{
        fieldPath: "notificationReads", appendMissingElements: { values: [{ stringValue: id }] },
      }] },
      currentDocument: { exists: true },
    }] }),
  });
  if (!response.ok) throw new Error("Could not save notification read state");
}

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
  kind: "post" | "update" = "post",
): Promise<void> {
  const id = String(post.id);
  const author = String(kind === "post" ? post.author_id : post.orgId);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const base = `projects/${PROJECT_ID}/databases/(default)/documents`;
  const fields = (data: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsVal(v)]));
  const writes: Record<string, unknown>[] = [{
    update: { name: `${base}/${kind === "post" ? "supporter_posts" : "updates"}/${id}`, fields: fields(post) },
    currentDocument: { exists: false },
  }];
  for (const edit of edits) {
    const response = await fetch(`${FIRESTORE}/supporter_post_media/${edit.id}`, { headers });
    if (!response.ok) throw new Error("Supporter media is unavailable");
    const doc = await response.json() as { fields: Record<string, FsValue>; updateTime: string };
    const media = fromFsDoc(doc.fields);
    if (media.author_id !== author || media.state !== "ready" || media.post_id)
      throw new Error("Supporter media cannot be attached");
    const data = { post_id: id, order: edit.order, crop: edit.crop, filter: edit.filter, adjustments: edit.adjustments,
      ...(kind === "update" ? { post_kind: "update" } : {}) };
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
