import assert from "node:assert/strict";
import test from "node:test";
import { fsGet, fsList, fsQuery } from "./firebase-rest.ts";

// Firestore REST omits `fields`/`values` for empty maps/arrays.
// Exercise the public readers without touching Firebase or stored documents.
const document = {
  name: "projects/test/databases/(default)/documents/organisations/example",
  fields: {
    name: { stringValue: "Example" },
    preferences: { mapValue: {} },
    explicitEmpty: { mapValue: { fields: {} } },
    nested: { mapValue: { fields: { empty: { mapValue: {} } } } },
    items: { arrayValue: { values: [{ mapValue: {} }, { mapValue: {
      fields: { empty: { mapValue: {} } },
    } }] } },
    emptyItems: { arrayValue: {} },
    count: { integerValue: "3" },
    amount: { doubleValue: 1.25 },
    active: { booleanValue: false },
    absent: { nullValue: null },
    createdAt: { timestampValue: "2026-11-23T12:00:00Z" },
  },
};

const expected = {
  name: "Example",
  preferences: {},
  explicitEmpty: {},
  nested: { empty: {} },
  items: [{}, { empty: {} }],
  emptyItems: [],
  count: 3,
  amount: 1.25,
  active: false,
  absent: null,
  createdAt: "2026-11-23T12:00:00Z",
};

for (const reader of ["get", "list", "query"] as const) {
  test(`Firestore ${reader} decodes empty maps at every nesting level without losing other values`, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      assert.ok(!init?.method || init.method === "POST");
      const body = reader === "get" ? document
        : reader === "list" ? { documents: [document] }
        : [{ document }];
      return Response.json(body);
    };
    try {
      if (reader === "get") {
        assert.deepEqual(await fsGet("organisations", "example", "test-token"), expected);
      } else {
        const result = reader === "list"
          ? await fsList("organisations", "test-token")
          : await fsQuery("organisations", [], "test-token");
        assert.deepEqual(result, [{ _id: "example", ...expected }]);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
