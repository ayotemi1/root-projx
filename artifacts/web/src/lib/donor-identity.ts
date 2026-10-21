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
// consumed once by the campaign page to ring the newest unit.
const RECEIPT = (campaignId: string) => `rpx_confirmed_receipt_${campaignId}`;

export function storeConfirmedReceipt(campaignId: string) {
  try { sessionStorage.setItem(RECEIPT(campaignId), String(Date.now())); } catch { /* ignore */ }
}

export function consumeConfirmedReceipt(campaignId: string): boolean {
  try {
    const v = sessionStorage.getItem(RECEIPT(campaignId));
    if (!v) return false;
    sessionStorage.removeItem(RECEIPT(campaignId));
    return Date.now() - Number(v) < 30 * 60_000;
  } catch {
    return false;
  }
}
