import assert from "node:assert/strict";
import test from "node:test";
import { recurringStatus } from "./recurring-status.ts";

test("recurring status maps every Stripe subscription state", () => {
  assert.equal(recurringStatus("active"), "active");
  assert.equal(recurringStatus("trialing"), "active");
  assert.equal(recurringStatus("paused"), "paused");
  assert.equal(recurringStatus("past_due"), "past_due");
  assert.equal(recurringStatus("unpaid"), "past_due");
  assert.equal(recurringStatus("incomplete"), "past_due");
  assert.equal(recurringStatus("canceled"), "canceled");
  assert.equal(recurringStatus("incomplete_expired"), "canceled");
});

test("paused collection is shown as paused without hiding cancellation", () => {
  assert.equal(recurringStatus("active", true), "paused");
  assert.equal(recurringStatus("canceled", true), "canceled");
  assert.equal(recurringStatus("incomplete_expired", true), "canceled");
  assert.equal(recurringStatus("active", false), "active");
});

test("unknown recurring status fails explicitly", () => {
  assert.throws(() => recurringStatus("unknown"), /Unsupported Stripe subscription status/);
});
