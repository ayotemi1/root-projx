import { Router } from "express";

const router = Router();

const MIGRATING = { error: "Follows routes pending Firestore migration (Step 6)" };

router.post("/follows",         (_req, res) => { res.status(501).json(MIGRATING); });
router.delete("/follows/:orgId",(_req, res) => { res.status(501).json(MIGRATING); });
router.get("/follows/my",       (_req, res) => { res.status(501).json(MIGRATING); });

export default router;
