import { fsGet, fsPatch, fsQuery, getServerToken } from "../firebase-rest.ts";
import { getUncachableStripeClient } from "../stripeClient.ts";
import { recordAndFulfilEmail } from "./obligations.ts";
import { emailDate, firstName, submitRenderedEmail } from "./service.ts";
import { EMAIL_SITE_URL, emailMoney, renderFinancialEmail } from "./templates.ts";
import { EmailEventDeferred } from "./pending.ts";

interface PayoutMailSnapshot {
  orgId: string; currency: "gbp" | "usd"; amount: number; reference: string;
  sentAt: string; periodStart?: string; periodEnd?: string; last4?: string; arrival?: string;
}
async function wisePaymentDetails(transferId: number) {
  const base = process.env.REPLIT_DEPLOYMENT === "1" ? "https://api.wise.com" : "https://api.sandbox.transferwise.tech";
  const key = process.env.WISE_API_KEY;
  if (!key) throw new Error("Payout confirmation lookup is unavailable.");
  async function get(path: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) { await response.body?.cancel(); throw new Error("Payout confirmation could not be checked."); }
    return await response.json() as Record<string, unknown>;
  }
  const transfer = await get(`/v1/transfers/${transferId}`);
  // Funding a transfer is not proof that Wise sent its outgoing bank payment.
  if (["incoming_payment_waiting", "incoming_payment_initiated", "processing", "funds_converted", "outgoing_payment_waiting"].includes(String(transfer.status))) {
    throw new EmailEventDeferred("Wise has not confirmed the outgoing payout yet.");
  }
  if (transfer.status !== "outgoing_payment_sent") throw new Error("Wise has not confirmed the outgoing payout.");
  if (!Number.isSafeInteger(transfer.targetAccount)) throw new Error("Payout destination could not be checked.");
  const account = await get(`/v1/accounts/${transfer.targetAccount}`);
  const details = account.details as Record<string, unknown> | undefined;
  const number = typeof details?.accountNumber === "string" ? details.accountNumber
    : typeof details?.iban === "string" ? details.iban : undefined;
  const arrival = transfer.estimatedDeliveryDate;
  return {
    last4: number && number.replace(/\s+/g, "").length >= 4 ? number.replace(/\s+/g, "").slice(-4) : undefined,
    arrival: typeof arrival === "string" && Number.isFinite(Date.parse(arrival)) ? arrival : undefined,
  };
}
async function legacySnapshot(batchId: string): Promise<PayoutMailSnapshot> {
  const rows = await fsQuery("payouts", [{ field: "batchId", op: "EQUAL", value: batchId }], await getServerToken());
  if (!rows.length || rows.some(p => p.status !== "sent" || p.orgId !== rows[0]!.orgId || p.currency !== "gbp" ||
      typeof p.sentAt !== "string" || !Number.isFinite(Date.parse(p.sentAt)) ||
      typeof p.amountGbp !== "number" || !Number.isFinite(p.amountGbp) || p.amountGbp <= 0)) {
    throw new Error("Payout batch is not durably and completely marked sent.");
  }
  const first = rows[0]!, dates = rows.map(p => String(p.createdAt)).sort();
  const wiseId = first.wiseTransferId;
  const details = typeof wiseId === "number" ? await wisePaymentDetails(wiseId) : {};
  return {
    orgId: String(first.orgId), currency: "gbp",
    amount: rows.reduce((sum, p) => sum + Math.round(Number(p.amountGbp) * 100), 0),
    reference: String(first.reference || batchId), sentAt: String(first.sentAt),
    periodStart: dates[0], periodEnd: dates.at(-1), ...details,
  };
}
async function stripeSnapshot(input: Record<string, unknown>): Promise<PayoutMailSnapshot> {
  const account = String(input.accountId), id = String(input.payoutId);
  if (!/^acct_[A-Za-z0-9]+$/.test(account) || !/^po_[A-Za-z0-9]+$/.test(id) ||
      !Number.isFinite(input.paidAt)) throw new Error("Payout event identity is invalid.");
  const token = await getServerToken();
  const orgs = await fsQuery("organisations", [{ field: "stripe_account_id", op: "EQUAL", value: account }], token, { limit: 2 });
  if (orgs.length !== 1) throw new Error("Connected payout has no unique organisation.");
  const stripe = await getUncachableStripeClient(), payout = await stripe.payouts.retrieve(id, {}, { stripeAccount: account });
  if (payout.status !== "paid" || !["gbp", "usd"].includes(payout.currency) || !Number.isSafeInteger(payout.amount) || payout.amount <= 0) {
    throw new Error("Stripe has not confirmed this supported-currency payout as paid.");
  }
  let destination = payout.destination;
  if (typeof destination === "string") destination = await stripe.accounts.retrieveExternalAccount(account, destination);
  const last4 = destination && typeof destination === "object" && "last4" in destination && typeof destination.last4 === "string"
    ? destination.last4 : undefined;
  const dates: number[] = [];
  if (payout.automatic) {
    for await (const transaction of stripe.balanceTransactions.list({ payout: id, limit: 100 }, { stripeAccount: account })) {
      if (["charge", "payment"].includes(transaction.type)) dates.push(transaction.created * 1000);
    }
  }
  return {
    orgId: String(orgs[0]!._id), currency: payout.currency as "gbp" | "usd", amount: payout.amount,
    reference: typeof payout.description === "string" && payout.description.trim() ? payout.description : payout.id,
    sentAt: new Date(Number(input.paidAt) * 1000).toISOString(), last4,
    ...(dates.length ? { periodStart: new Date(Math.min(...dates)).toISOString(), periodEnd: new Date(Math.max(...dates)).toISOString() } : {}),
    ...(payout.arrival_date ? { arrival: new Date(payout.arrival_date * 1000).toISOString() } : {}),
  };
}
export async function deliverPayoutEmail(input: Record<string, unknown>) {
  const batchId = typeof input.batchId === "string" ? input.batchId : undefined;
  const snapshot = batchId ? await legacySnapshot(batchId) : await stripeSnapshot(input);
  const token = await getServerToken();
  const [org, owner] = await Promise.all([
    fsGet("organisations", snapshot.orgId, token, { includeDeleted: true }), fsGet("users", snapshot.orgId, token),
  ]);
  if (!org || typeof owner?.email !== "string") throw new Error("Payout owner has no private delivery identity.");
  const variables = {
    first_name: firstName(owner.name), org_name: String(org.name),
    payout_amount: emailMoney(snapshot.amount, snapshot.currency), payout_reference: snapshot.reference,
    sent_date: emailDate(snapshot.sentAt), payouts_url: `${EMAIL_SITE_URL}/dashboard?tab=profile`,
    ...(snapshot.periodStart && snapshot.periodEnd ? { period_start: emailDate(snapshot.periodStart), period_end: emailDate(snapshot.periodEnd) } : {}),
    ...(snapshot.last4 ? { account_last4: snapshot.last4 } : {}),
    ...(snapshot.arrival ? { arrival_date: emailDate(snapshot.arrival) } : {}),
  };
  const omit = [...(!snapshot.last4 ? ["account_last4"] : []), ...(!snapshot.arrival ? ["arrival_date"] : []),
    ...(!snapshot.periodStart || !snapshot.periodEnd ? ["period_start"] : [])];
  await submitRenderedEmail(`payout:${batchId ?? `${input.accountId}:${input.payoutId}`}`, owner.email,
    renderFinancialEmail("15-org-payout-sent", variables, omit));
}
export async function payoutEmailEvent(batchId: string, defer = true) {
  await recordAndFulfilEmail(batchId, "payout", { batchId }, defer);
  const token = await getServerToken();
  const rows = await fsQuery("payouts", [{ field: "batchId", op: "EQUAL", value: batchId }], token);
  for (const row of rows) await fsPatch("payouts", String(row._id), { emailPayoutPending: false }, token);
}
export function stripePayoutEmailEvent(accountId: string, payoutId: string, paidAt: number) {
  return recordAndFulfilEmail(`${accountId}:${payoutId}`, "payout", { accountId, payoutId, paidAt }, true);
}
