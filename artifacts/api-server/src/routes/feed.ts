import { Router } from "express";

const router = Router();

const MIGRATING = { error: "Feed routes pending Firestore migration (Step 6)" };

router.get("/feed/public",  (_req, res) => { res.status(501).json(MIGRATING); });
router.get("/feed",         (_req, res) => { res.status(501).json(MIGRATING); });
router.get("/feed/org/:id", (_req, res) => { res.status(501).json(MIGRATING); });
router.post("/feed",        (_req, res) => { res.status(501).json(MIGRATING); });

export default router;
