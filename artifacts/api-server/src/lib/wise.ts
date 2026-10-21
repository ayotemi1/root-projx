import { randomUUID } from "node:crypto";
import { fsGet, fsPatch, getServerToken } from "./firebase-rest.js";

const WISE_BASE = process.env.REPLIT_DEPLOYMENT === "1"
  ? "https://api.wise.com" : "https://api.sandbox.transferwise.tech";

export async function getWisePlatformProfileId(apiKey: string): Promise<number> {
  const response = await fetch(`${WISE_BASE}/v1/profiles`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error("Failed to reach the Wise API — check that WISE_API_KEY is valid.");
  const profiles = await response.json() as Array<{ id: number; type: string }>;
  const profile = profiles.find(p => p.type === "BUSINESS") ?? profiles[0];
  if (!profile) throw new Error("No Wise profile found on this API key.");
  return profile.id;
}

export async function disburseToOrg(orgId: string, amountGbp: number, reference: string): Promise<number> {
  if (!Number.isFinite(amountGbp) || amountGbp <= 0 ||
      Math.abs(amountGbp * 100 - Math.round(amountGbp * 100)) > 0.00001) {
    throw new Error("Disbursement must be a positive whole-pence GBP amount");
  }
  const apiKey = process.env.WISE_API_KEY;
  if (!apiKey) throw new Error("WISE_API_KEY is not configured on this server.");
  const token = await getServerToken();
  const org = await fsGet("organisations", orgId, token);
  if (!org) throw new Error("Organisation not found");
  const owner = await fsGet("users", orgId, token);
  if (owner?.approvalStatus === "pending" || owner?.approvalStatus === "declined") {
    throw new Error("This organisation is not approved for payouts");
  }
  if (!org.wise_recipient_id) throw new Error("This organisation has not connected a Wise account yet.");
  const profileId = await getWisePlatformProfileId(apiKey);
  async function post(path: string, body: Record<string, unknown>) {
    const result = await fetch(`${WISE_BASE}${path}`, { method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    if (!result.ok) throw new Error(`Wise request ${path} failed (${result.status}); check Wise before retrying.`);
    return result.json();
  }
  const quote = await post(`/v3/profiles/${profileId}/quotes`, {
    sourceCurrency: "GBP", targetCurrency: "GBP", sourceAmount: amountGbp, payOut: "BALANCE",
  }) as { id: string };
  const transfer = await post("/v1/transfers", {
    targetAccount: org.wise_recipient_id, quoteUuid: quote.id, customerTransactionId: randomUUID(),
    details: { reference: reference.trim() || `Root ProjX — ${org.name ?? orgId}`,
      transferPurpose: "verification.transfers.purpose.pay.bills", sourceOfFunds: "verification.source.of.funds.other" },
  }) as { id: number; status: string };
  let payment: { status: string };
  try {
    payment = await post(`/v3/profiles/${profileId}/transfers/${transfer.id}/payments`, { type: "BALANCE" }) as { status: string };
    if (payment.status !== "COMPLETED") throw new Error("Funding not completed");
  } catch {
    throw Object.assign(new Error(`Wise transfer ${transfer.id} created but funding was not confirmed. Reconcile in Wise; do not retry automatically.`),
      { wiseTransferId: transfer.id });
  }
  try {
    await fsPatch("organisations", orgId, {
      lastDisbursementAt: new Date().toISOString(), lastDisbursementAmountGbp: amountGbp,
      lastDisbursementTransferId: transfer.id, lastDisbursementTransferStatus: transfer.status,
      lastDisbursementPaymentStatus: payment.status,
    }, token);
  } catch {
    throw Object.assign(new Error(`Wise transfer ${transfer.id} funded, but recording failed. Reconcile before retrying.`),
      { wiseTransferId: transfer.id });
  }
  return transfer.id;
}
