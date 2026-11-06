import { randomUUID } from "node:crypto";
import { Router } from "express";
import { requireAuth, requireApprovedOrganisation } from "../lib/auth.js";
import { requireAdmin } from "../lib/admin-auth.js";
import { fsGet, fsMutateBankDetails, getServerToken } from "../lib/firebase-rest.js";
import { activePayoutMethod } from "../lib/payout-setup.js";
import { bankDetailsSummary, decryptBankDetails, encryptBankDetails, validateBankDetails } from "../lib/bank-details.js";

const router = Router();
router.param("id", (_req, res, next, id) => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) { res.status(400).json({ error: "Invalid organisation ID." }); return; }
  next();
});
router.use((req, res, next) => {
  if (req.path.includes("/bank-details")) res.setHeader("Cache-Control", "no-store");
  next();
});

router.get("/payout/bank-details", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    const token = await getServerToken(), id = req.user!.userId;
    const org = await fsGet("organisations", id, token);
    if (!org) { res.status(404).json({ error: "Organisation not found." }); return; }
    const record = await fsGet("organisation_bank_details", id, token);
    res.json(bankDetailsSummary(record, org));
  } catch {
    req.log?.error("Could not load private bank detail status");
    res.status(503).json({ error: "Bank details are unavailable. Please try again." });
  }
});

router.put("/payout/bank-details", requireAuth, requireApprovedOrganisation, async (req, res) => {
  let details;
  try { details = validateBankDetails(req.body); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); return; }
  try {
    const id = req.user!.userId, token = await getServerToken();
    const revision = randomUUID(), submittedAt = new Date().toISOString();
    const encrypted = encryptBankDetails(details, id);
    const result = await fsMutateBankDetails(id, token, (org) => {
      if (activePayoutMethod(org) !== "bank_transfer") throw new Error("Select bank transfer first.");
      if (org.payoutSettlementBatchId) throw new Error("A payout is being reconciled. Contact Root ProjX before changing bank details.");
      return {
        orgUpdates: { bankDetailsRevision: revision, payoutManualApproved: false, payoutManualRequested: true },
        record: { encrypted, revision, submittedAt },
        result: { hasDetails: true, revision, submittedAt, approved: false },
      };
    });
    req.log?.info({ organisationId: id }, "Organisation submitted bank details for review");
    res.json(result);
  } catch {
    req.log?.error("Could not save private bank details");
    res.status(503).json({ error: "Bank details were not saved. Secure storage may need configuring, or a payout may be in progress. Keep this page open and retry or contact Root ProjX." });
  }
});

router.get("/admin/organisations/:id/bank-details", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id), token = await getServerToken();
    const org = await fsGet("organisations", id, token, { includeDeleted: true });
    if (!org) { res.status(404).json({ error: "Organisation not found." }); return; }
    const record = await fsGet("organisation_bank_details", id, token);
    if (!record) { res.json({ ...bankDetailsSummary(null, org), details: null }); return; }
    const details = decryptBankDetails(String(record.encrypted), id);
    req.log?.info({ organisationId: id }, "Administrator viewed private payout bank details");
    res.json({ ...bankDetailsSummary(record, org), details });
  } catch {
    req.log?.error("Could not open private bank details");
    res.status(503).json({ error: "Bank details could not be opened. Check secure storage configuration and retry." });
  }
});

router.post("/admin/organisations/:id/bank-details/approve", requireAdmin, async (req, res) => {
  const revision = req.body?.revision;
  if (typeof revision !== "string" || !revision) {
    res.status(400).json({ error: "Open and review the saved bank details before approving." }); return;
  }
  try {
    const id = String(req.params.id), token = await getServerToken();
    await fsMutateBankDetails(id, token, (org, record) => {
      if (!record || record.revision !== revision || org.bankDetailsRevision !== revision) {
        throw new Error("Bank details changed. Close and reopen this review before approving.");
      }
      if (activePayoutMethod(org) !== "bank_transfer" || org.payoutSettlementBatchId) {
        throw new Error("Bank transfer must be selected and no payout may be in progress.");
      }
      // Decryption must succeed before an unusable encrypted record is approved.
      decryptBankDetails(String(record.encrypted), id);
      return { orgUpdates: { payoutManualApproved: true }, result: null };
    });
    req.log?.info({ organisationId: id }, "Administrator approved reviewed bank detail revision");
    res.json({ approved: true });
  } catch {
    res.status(409).json({ error: "Approval was not saved. Bank details may have changed, bank transfer may no longer be selected, or a payout may be in progress. Reopen and review the latest details." });
  }
});

export default router;
