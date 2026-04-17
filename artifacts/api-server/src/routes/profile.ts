import { Router } from "express";

const router = Router();

const MIGRATING = { error: "Profile routes pending Firestore migration (Step 6)" };

router.get("/profile",   (_req, res) => { res.status(501).json(MIGRATING); });
router.patch("/profile", (_req, res) => { res.status(501).json(MIGRATING); });

export default router;
