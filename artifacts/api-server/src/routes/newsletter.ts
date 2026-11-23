import { Router } from "express";
import { brevoAddContact } from "../lib/brevo.js";

const router = Router();

// POST /newsletter/subscribe — add an email to the Brevo newsletter list
// Public endpoint (no auth required) — used by the web/mobile footer subscribe form
router.post("/newsletter/subscribe", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }

    // Do not claim a newsletter subscription when the helper would no-op or
    // merely create an unlisted contact. Both the connection and list are needed.
    const list = process.env.BREVO_NEWSLETTER_LIST_ID;
    if (!process.env.BREVO_API_KEY || !list || !/^[1-9]\d*$/.test(list) || !Number.isSafeInteger(Number(list))) {
      res.status(503).json({ error: "Newsletter sign-up is temporarily unavailable. Please try again later." });
      return;
    }

    const nameParts = name.split(" ");
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(" ") || undefined;

    await brevoAddContact({
      email,
      firstName,
      lastName,
      listIds: [Number(list)],
      updateEnabled: true,
    });

    res.json({ message: "You've been subscribed to the Root ProjX newsletter." });
  } catch (err) {
    // Provider errors may echo the submitted address. Never put that payload
    // (or credentials) in the request log.
    req.log.error({ errorType: err instanceof Error ? err.name : "Unknown" }, "POST /newsletter/subscribe failed");
    res.status(500).json({ error: "Failed to subscribe — please try again later." });
  }
});

export default router;
