// First-party, per-browser id so repeat guest gifts count as one supporter.
// The server hashes it; it is never shown publicly.
const KEY = "rpx_anonymous_donor_id";

export function getAnonymousDonorId(): string | undefined {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      if (typeof crypto?.randomUUID !== "function") return undefined;
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

// Verified receipt handoff: written only after confirm says recorded=true,
// consumed once by the campaign page to show a confirmed-gift acknowledgement.
const RECEIPT = (campaignId: string) => `rpx_confirmed_receipt_${campaignId}`;

export interface ConfirmedReceiptDetails { amount: number | null; currency: "gbp" | "usd" }

/** Stores only the verified native gift amount and currency. Never names or emails. */
export function storeConfirmedReceipt(campaignId: string, details?: ConfirmedReceiptDetails) {
  try {
    sessionStorage.setItem(RECEIPT(campaignId), JSON.stringify({ t: Date.now(), amount: details?.amount ?? null, currency: details?.currency ?? "gbp" }));
  } catch { /* ignore */ }
}

/** Consumes a verified receipt once; returns its details or null. Accepts the legacy timestamp format. */
export function consumeConfirmedReceiptDetails(campaignId: string): ConfirmedReceiptDetails | null {
  try {
    const v = sessionStorage.getItem(RECEIPT(campaignId));
    if (!v) return null;
    sessionStorage.removeItem(RECEIPT(campaignId));
    let t = Number(v); let amount: number | null = null; let currency: "gbp" | "usd" = "gbp";
    if (!Number.isFinite(t)) {
      const o = JSON.parse(v) as { t?: unknown; amount?: unknown; currency?: unknown };
      t = Number(o.t);
      amount = typeof o.amount === "number" && Number.isFinite(o.amount) && o.amount > 0 ? o.amount : null;
      currency = o.currency === "usd" ? "usd" : "gbp";
    }
    const age = Date.now() - t;
    return Number.isFinite(age) && age >= 0 && age < 30 * 60_000 ? { amount, currency } : null;
  } catch {
    return null;
  }
}

export function consumeConfirmedReceipt(campaignId: string): boolean {
  return consumeConfirmedReceiptDetails(campaignId) !== null;
}
