import { Router } from "express";

const router = Router();

const MIGRATING = { error: "Organisations routes pending Firestore migration (Step 6)" };

router.get("/organisations",      (_req, res) => { res.status(501).json(MIGRATING); });
router.get("/organisations/:id",  (_req, res) => { res.status(501).json(MIGRATING); });
router.post("/organisations",     (_req, res) => { res.status(501).json(MIGRATING); });
router.patch("/organisations/:id",(_req, res) => { res.status(501).json(MIGRATING); });

export default router;
