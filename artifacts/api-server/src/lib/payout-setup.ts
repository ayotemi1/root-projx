export type PayoutMethod = "stripe" | "wise" | "bank_transfer";
export type ResolvedPayoutMethod = "stripe_connect" | "wise" | "manual" | "none";

// Old organisations have connected-provider fields but no explicit selection.
// A saved selection always wins; retaining another provider's credentials
// does not make that provider the active method.
export function activePayoutMethod(org: Record<string, unknown>): PayoutMethod | null {
  if (org.payoutMethod === "stripe" || org.payoutMethod === "wise" || org.payoutMethod === "bank_transfer") {
    return org.payoutMethod;
  }
  if (org.stripe_account_id && org.payouts_enabled) return "stripe";
  if (org.wise_email) return "wise";
  if (org.payoutManualRequested || org.payoutManualApproved) return "bank_transfer";
  if (org.stripe_account_id) return "stripe";
  return null;
}

// Resolve the selected routing method, not provider readiness or permission to
// send funds. Keep the existing dashboard/storage values backwards compatible.
export function resolvePayoutMethod(org: Record<string, unknown>): ResolvedPayoutMethod {
  switch (activePayoutMethod(org)) {
    case "stripe": return "stripe_connect";
    case "wise": return "wise";
    case "bank_transfer": return "manual";
    default: return "none";
  }
}

export function payoutSetup(org: Record<string, unknown>) {
  return {
    method: activePayoutMethod(org),
    payoutManualRequested: org.payoutManualRequested === true,
    payoutManualApproved: org.payoutManualApproved === true,
    payoutManualLabel: typeof org.payoutManualLabel === "string" ? org.payoutManualLabel : null,
  };
}

// Operator payee reminders and setup flags are not public profile fields.
export function withoutPrivatePayoutSetup(org: Record<string, unknown>) {
  const {
    payoutMethod: _method,
    payoutManualRequested: _requested,
    payoutManualApproved: _approved,
    payoutManualLabel: _label,
    ...publicFields
  } = org;
  return { ...publicFields, payoutMethod: resolvePayoutMethod(org) };
}

export function manualPayoutLabel(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Payout label must be text");
  const label = value.trim();
  if (label.length > 100) throw new Error("Payout label must be 100 characters or fewer");
  if (
    /\d(?:[\s-]*\d){5,}/.test(label) ||
    /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){10,30}\b/i.test(label) ||
    /\b(?:iban|routing|sort\s*code|account\s*(?:number|no\.?))\b/i.test(label)
  ) {
    throw new Error("Use a short provider/payee reminder only, without bank account details");
  }
  return label || null;
}
