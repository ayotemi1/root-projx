import { Router } from "express";
import { requireAdmin } from "../lib/admin-auth.js";
import { requireAuth, requireApprovedOrganisation } from "../lib/auth.js";
import { payoutOverview, runPayouts, markPayoutsSent, organisationPayoutSummary } from "../lib/payout-settlement.js";
import { GetAdminPayoutsResponse, RunAdminPayoutsResponse, MarkAdminPayoutsSentBody,
  MarkAdminPayoutsSentResponse, GetMyPayoutSummaryResponse } from "@workspace/api-zod";

const router=Router();
router.get("/admin/payouts",requireAdmin,async(req,res)=>{
  try { res.json(GetAdminPayoutsResponse.parse(await payoutOverview())); }
  catch(err) {req.log.error({err},"Payout overview failed");res.status(500).json({error:"Could not load payouts"});}
});
router.post("/admin/payouts/run",requireAdmin,async(req,res)=>{
  try {res.json(RunAdminPayoutsResponse.parse(await runPayouts()));}
  catch(err) {req.log.error({err},"Payout run failed");res.status(500).json({error:"Could not run payouts"});}
});
router.post("/admin/payouts/mark-sent",requireAdmin,async(req,res)=>{
  const parsed=MarkAdminPayoutsSentBody.safeParse(req.body);
  const body=req.body;
  if(!parsed.success || !body.orgId.trim() ||
    typeof body.reference!=="string" || !body.reference.trim() || body.reference.length>120 ||
    Object.keys(body).some(k=>!["orgId","reference"].includes(k))) {
    res.status(400).json({error:"Provide orgId and a transfer reference (1–120 characters)."});return;
  }
  try {
    const result=await markPayoutsSent(body.orgId.trim(),body.reference.trim());
    res.status(result.status==="sent"?200:409).json(MarkAdminPayoutsSentResponse.parse(result));
  } catch(err) {req.log.error({err},"Manual settlement recording failed");res.status(500).json({error:"Could not record settlement; check payout history before retrying."});}
});
router.get("/payouts/my",requireAuth,requireApprovedOrganisation,async(req,res)=>{
  try {res.json(GetMyPayoutSummaryResponse.parse(await organisationPayoutSummary(req.user!.userId)));}
  catch(err) {req.log.error({err},"Organisation payout summary failed");res.status(500).json({error:"Could not load payout summary"});}
});
export default router;
