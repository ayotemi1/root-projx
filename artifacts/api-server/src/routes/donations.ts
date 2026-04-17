import { Router } from "express";

const router = Router();

const MIGRATING = { error: "Donations routes pending Firestore migration (Step 6)" };

router.post("/donations",     (_req, res) => { res.status(501).json(MIGRATING); });
router.get("/donations/my",   (_req, res) => { res.status(501).json(MIGRATING); });

export default router;
