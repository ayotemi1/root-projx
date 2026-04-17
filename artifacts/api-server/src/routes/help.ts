import { Router } from "express";

const router = Router();

const MIGRATING = { error: "Help routes pending Firestore migration (Step 6)" };

router.get("/help/orgs",           (_req, res) => { res.status(501).json(MIGRATING); });
router.post("/help/contact",       (_req, res) => { res.status(501).json(MIGRATING); });
router.get("/help/reviews/:orgId", (_req, res) => { res.status(501).json(MIGRATING); });
router.post("/help/reviews",       (_req, res) => { res.status(501).json(MIGRATING); });

export default router;
