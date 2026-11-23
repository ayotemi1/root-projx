import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mediaRange } from "./media-range.ts";

test("supports start/end, open-ended and suffix video ranges", () => {
  assert.deepEqual(mediaRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(mediaRange("bytes=40-", 100), { start: 40, end: 99 });
  assert.deepEqual(mediaRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(mediaRange("bytes=90-150", 100), { start: 90, end: 99 });
});
test("rejects malformed, multiple and unsatisfiable ranges", () => {
  for (const value of ["bytes=100-", "bytes=30-20", "bytes=-0", "bytes=-", "bytes=0-1,3-4", "items=0-4", "bytes=-abc"]) {
    assert.equal(mediaRange(value, 100), null, value);
  }
});
