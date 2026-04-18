import { Router } from "express";
import { brevoAddContact } from "../lib/brevo.js";

const router = Router();

// POST /newsletter/subscribe — add an email to the Brevo newsletter list
// Public endpoint (no auth required) — used by the web/mobile footer subscribe form
router.post("/newsletter/subscribe", async (req, res) => {
  try {
    const { email, name } = req.body as { email?: string; name?: string };

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }

    const nameParts = (name ?? "").trim().split(" ");
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(" ") || undefined;

    const newsletterListId = process.env.BREVO_NEWSLETTER_LIST_ID
      ? [parseInt(process.env.BREVO_NEWSLETTER_LIST_ID, 10)]
      : undefined;

    await brevoAddContact({
      email: email.toLowerCase(),
      firstName,
      lastName,
      listIds: newsletterListId,
      updateEnabled: true,
    });

    res.json({ message: "You've been subscribed to the Root ProjX newsletter." });
  } catch (err) {
    req.log.error({ err }, "POST /newsletter/subscribe error");
    res.status(500).json({ error: "Failed to subscribe — please try again later." });
  }
});

export default router;
