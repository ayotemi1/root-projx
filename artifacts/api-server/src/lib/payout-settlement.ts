import { randomUUID } from "node:crypto";
import { fsGet, fsPatch, fsQuery, fsTrySettlementLock, fsReleaseSettlementLock, getServerToken } from "./firebase-rest.js";
import { payoutDue, type Payout } from "./payouts.js";
import { resolvePayoutMethod } from "./payout-setup.js";
import { disburseToOrg } from "./wise.js";
import { payoutEmailEvent } from "./email/payout-events.js";

const total = (rows: Payout[]) => rows.reduce((sum, p) => sum + Math.round(p.amountGbp * 100), 0) / 100;
export async function listPayouts(token: string, orgId?: string): Promise<Payout[]> {
  const rows = await fsQuery("payouts", orgId ? [{field:"orgId",op:"EQUAL",value:orgId}] : [], token);
  return (rows as unknown as Payout[]).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}

export async function payoutOverview() {
  const token = await getServerToken();
  const payouts = await listPayouts(token);
  const organisations = await Promise.all([...new Set(payouts.map(p=>p.orgId))].map(async orgId => {
    const rows = payouts.filter(p=>p.orgId===orgId);
    const org = await fsGet("organisations",orgId,token,{includeDeleted:true});
    const queued = rows.filter(p=>p.status==="queued");
    const {due,eligibleTotalGbp}=payoutDue(queued);
    return {
      orgId, orgName: String(org?.name ?? rows[0]?.orgName ?? orgId),
      method: org ? resolvePayoutMethod(org) : "none",
      queuedTotalGbp: total(queued), eligibleTotalGbp, due,
      settlementLocked: !!org?.payoutSettlementBatchId,
    };
  }));
  return { payouts, organisations, totalQueuedGbp: total(payouts.filter(p=>p.status==="queued")),
    failureCount: payouts.filter(p=>p.status==="failed").length };
}

export interface SettlementResult {
  orgId: string; orgName: string; amountGbp: number;
  status: "sent" | "failed" | "not_due" | "needs_manual_settlement" | "locked";
  batchId?: string; wiseTransferId?: number; error?: string;
}

async function settleOrg(orgId: string, token: string, manualReference?: string): Promise<SettlementResult> {
  let org = await fsGet("organisations",orgId,token,{includeDeleted:true});
  const orgName = String(org?.name ?? orgId);
  let rows = (await listPayouts(token,orgId)).filter(p=>p.status==="queued");
  let eligibility = payoutDue(rows);
  const result = (status: SettlementResult["status"], extra = {}): SettlementResult =>
    ({orgId,orgName,amountGbp:eligibility.eligibleTotalGbp,status,...extra});
  if (!eligibility.eligible.length || (!manualReference && !eligibility.due)) return result("not_due");
  if (!org) return result("failed",{error:"Organisation not found"});
  if (org.payoutSettlementBatchId) return result("locked",{error:"Previous settlement needs reconciliation."});
  if (!manualReference && (resolvePayoutMethod(org) !== "wise" || !process.env.WISE_API_KEY)) {
    return result("needs_manual_settlement");
  }
  const batchId = randomUUID();
  if (!await fsTrySettlementLock(orgId,batchId,token)) return result("locked");
  let finalized = false;
  let transferId: number | undefined;
  try {
    // Re-read after acquiring the cross-process lock. Never settle a stale list.
    rows = (await listPayouts(token,orgId)).filter(p=>p.status==="queued");
    eligibility = payoutDue(rows);
    if (!eligibility.eligible.length || (!manualReference && !eligibility.due)) {
      finalized=true;
      return result("not_due");
    }
    org = await fsGet("organisations",orgId,token,{includeDeleted:true});
    if (!manualReference && (!org || resolvePayoutMethod(org)!=="wise" || !process.env.WISE_API_KEY)) {
      finalized=true;
      return result("needs_manual_settlement");
    }
    const reference = manualReference ?? `Root ProjX ${batchId.slice(0,8)}`;
    try {
      if (eligibility.eligible.some(p=>p.currency.toLowerCase()!=="gbp" ||
          !Number.isFinite(p.amountGbp) || p.amountGbp<=0)) {
        throw new Error("Only positive GBP payouts can be settled");
      }
      // Persist batch/reference before any external action. An interrupted run
      // remains locked and visible; it can never silently trigger a second send.
      for (const payout of eligibility.eligible) {
        await fsPatch("payouts",payout._id,{batchId,reference},token);
      }
      if (!manualReference) transferId = await disburseToOrg(orgId,eligibility.eligibleTotalGbp,reference);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Settlement failed";
      const knownId = transferId ?? (error as {wiseTransferId?:number})?.wiseTransferId;
      for (const payout of eligibility.eligible) {
        await fsPatch("payouts",payout._id,{status:"failed",batchId,reference,error:message,
          ...(knownId ? {wiseTransferId:knownId} : {})},token);
      }
      finalized=true;
      return result("failed",{batchId,error:message,...(knownId?{wiseTransferId:knownId}:{})});
    }
    const sentAt=new Date().toISOString();
    for (const payout of eligibility.eligible) {
      await fsPatch("payouts",payout._id,{
        status:"sent",sentAt,sentBy:manualReference ? "manual" : "wise",reference,batchId,emailPayoutPending:true,
        ...(transferId ? {wiseTransferId:transferId} : {}),
      },token);
    }
    finalized=true;
    // Failure here cannot undo or repeat a confirmed transfer. Source-side
    // markers and the email worker recover the notification independently.
    try { await payoutEmailEvent(batchId); } catch { /* retained emailPayoutPending markers */ }
    return result("sent",{batchId,...(transferId ? {wiseTransferId:transferId} : {})});
  } finally {
    // Leave lock intact after uncertain persistence failure; never resend.
    if (finalized) await fsReleaseSettlementLock(orgId,token);
  }
}

export async function runPayouts() {
  const token=await getServerToken();
  const orgIds=[...new Set((await listPayouts(token)).filter(p=>p.status==="queued").map(p=>p.orgId))];
  const results: SettlementResult[]=[];
  for (const orgId of orgIds) {
    try { results.push(await settleOrg(orgId,token)); }
    catch (err) {
      results.push({orgId,orgName:orgId,amountGbp:0,status:"failed",
        error:err instanceof Error?err.message:"Settlement failed; reconcile before retrying."});
    }
  }
  return {results};
}

export async function markPayoutsSent(orgId: string, reference: string) {
  return settleOrg(orgId,await getServerToken(),reference);
}

export async function organisationPayoutSummary(orgId: string) {
  const token=await getServerToken();
  const rows=await listPayouts(token,orgId);
  const settled=rows.filter(p=>p.status==="sent").sort((a,b)=>(b.sentAt??"").localeCompare(a.sentAt??""));
  const last=settled[0];
  const batch=last ? settled.filter(p=>last.batchId ? p.batchId===last.batchId : p._id===last._id) : [];
  return {
    pendingGbp:total(rows.filter(p=>p.status==="queued")),
    lastSettled:last ? {amountGbp:total(batch),sentAt:last.sentAt??null} : null,
    payoutMethod:resolvePayoutMethod(await fsGet("organisations",orgId,token,{includeDeleted:true})??{}),
  };
}
