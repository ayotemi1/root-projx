import { Router } from "express";

const router = Router();

const MIGRATING = { error: "Auth routes pending Firebase migration (Step 4)" };

router.post("/auth/register", (_req, res) => { res.status(501).json(MIGRATING); });
router.post("/auth/login",    (_req, res) => { res.status(501).json(MIGRATING); });
router.post("/auth/logout",   (_req, res) => { res.status(501).json(MIGRATING); });
router.get("/auth/me",        (_req, res) => { res.status(501).json(MIGRATING); });

export default router;
