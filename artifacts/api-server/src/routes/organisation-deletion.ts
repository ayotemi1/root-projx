import { Router } from "express";
import { requireAdmin } from "../lib/admin-auth.js";
import { fsGet, fsPatch, fsQuery, getServerToken } from "../lib/firebase-rest.js";

const router = Router();

// Retain the organisation document for existing payments, reconciliation and
// settlement. Normal Firestore reads hide tombstones; only accounting opts in.
router.delete("/admin/organisations/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  if (!/^[\w-]+$/.test(id)) {
    res.status(400).json({ error: "Invalid organisation ID" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const token = await getServerToken();
    const org = await fsGet("organisations", id, token, { includeDeleted: true });
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    if (typeof req.body?.confirmationName !== "string" || req.body.confirmationName !== org.name) {
      res.status(400).json({ error: "Type the organisation name exactly to confirm deletion." });
      return;
    }
    if (!org.deletedAt) {
      const recurring = await fsQuery("recurring", [{ field: "orgId", op: "EQUAL", value: id }], token);
      if (recurring.some((record) => record.status !== "canceled")) {
        res.status(409).json({ error: "Cancel this organisation's recurring donations before deleting it, so supporters are not charged after removal." });
        return;
      }
      // One atomic field update: campaigns, balances and payment connections
      // are deliberately not rewritten or destroyed.
      await fsPatch("organisations", id, {
        deletedAt: new Date().toISOString(),
        deletedBy: "admin",
      }, token);
      req.log.info({ organisationId: id }, "Admin deleted organisation from platform");
    }
    res.json({ deleted: true, orgId: id });
  } catch (err) {
    req.log.error({ err, organisationId: id }, "Organisation deletion failed");
    res.status(500).json({ error: "Could not delete the organisation. Please try again." });
  }
});

export default router;
