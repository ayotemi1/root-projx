const API_KEY = process.env.FIREBASE_API_KEY!;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;
const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
  return fromFsDoc(doc.fields ?? {});
}

export async function fsPatch(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
  idToken?: string,
): Promise<void> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFsVal(v);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

  const res = await fetch(`${FIRESTORE}/${collection}/${docId}`, {
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
): Promise<Array<Record<string, unknown>>> {
  const structuredQuery = {
    from: [{ collectionId: collection }],
    where: filters.length === 1
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
        },
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
    }));
}
