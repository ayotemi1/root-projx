import { Router, type Request, type Response } from "express";
import { requireAuth, requireApprovedOrganisation } from "../lib/auth.js";
import { fsGet, fsPatch, getServerToken } from "../lib/firebase-rest.js";
import { payoutSetup } from "../lib/payout-setup.js";

const router = Router();

async function setup(req: Request, res: Response): Promise<void> {
  try {
    const token = await getServerToken();
    const id = req.user!.userId;
    const org = await fsGet("organisations", id, token);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    if (req.method === "GET") {
      res.json(payoutSetup(org));
      return;
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "method") ||
      !["stripe", "wise", "bank_transfer"].includes(body.method)) {
      res.status(400).json({ error: "Provide only a payout method: stripe, wise or bank_transfer" });
      return;
    }
    const updates: Record<string, unknown> = { payoutMethod: body.method };
    if (body.method === "bank_transfer") updates.payoutManualRequested = true;
    // Only admin may set approval or the off-platform payee reminder.
    await fsPatch("organisations", id, updates, token);
    res.json(payoutSetup({ ...org, ...updates }));
  } catch (err) {
    req.log.error({ err }, "Payout setup failed");
    res.status(500).json({ error: "Could not save or load payout setup" });
  }
}

router.get("/payout/setup", requireAuth, requireApprovedOrganisation, setup);
router.put("/payout/setup", requireAuth, requireApprovedOrganisation, setup);

export default router;
