import assert from "node:assert/strict";
import test from "node:test";
import { organisationAccessDecision } from "./organisation-approval.ts";

test("approved organisations can access organisation tools", () => {
  assert.equal(organisationAccessDecision("organisation", "approved"), "allow");
});

test("pending organisations cannot access organisation tools", () => {
  assert.equal(organisationAccessDecision("organisation", "pending"), "deny");
});

test("declined organisations cannot access organisation tools", () => {
  assert.equal(organisationAccessDecision("organisation", "declined"), "deny");
});

test("supporters cannot access organisation tools", () => {
  assert.equal(organisationAccessDecision("supporter"), "deny");
});

test("legacy organisations require an established profile check", () => {
  assert.equal(organisationAccessDecision("organisation"), "check-legacy-profile");
});