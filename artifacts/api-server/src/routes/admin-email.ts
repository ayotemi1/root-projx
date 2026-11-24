import { Router } from "express";
import { ROOT_ADMIN_EMAIL } from "../lib/email-identity.ts";
import { rateLimit } from "express-rate-limit";
import { requireAdmin } from "../lib/admin-auth.js";
import { brevoSendEmail } from "../lib/brevo.js";

const router = Router();

router.post("/admin/email/test", requireAdmin,
  // All administrators share the same credential and fixed team recipient.
  // In-memory, per-instance protection; not a distributed delivery guarantee.
  rateLimit({
    windowMs: 60_000, limit: 1, keyGenerator: () => "admin-email-test",
    standardHeaders: "draft-7", legacyHeaders: false,
    message: { error: "Please wait one minute before sending another test email." },
  }),
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!process.env.BREVO_API_KEY) {
      res.status(503).json({ error: "Brevo email is not configured. No test email was sent." });
      return;
    }
    const recipient = ROOT_ADMIN_EMAIL;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      res.status(503).json({ error: "The team email address is not configured correctly." });
      return;
    }
    const environment = process.env.NODE_ENV === "production" ? "production" : "development";
    const sentAt = new Date().toISOString();
    try {
      await brevoSendEmail({
        to: [{ email: recipient }],
        subject: "Root ProjX — email delivery test",
        htmlContent: `<h1>Root ProjX email delivery test</h1>
          <p>An administrator requested this test from the ${environment} server at ${sentAt}.</p>
          <p>No donation, account or payment was created. Receiving this message confirms delivery to this mailbox.</p>`,
      });
      req.log.info({ environment }, "Admin test email accepted by Brevo");
      res.json({ accepted: true, recipient, environment, sentAt });
    } catch (err) {
      // Provider errors can contain addresses. Return/log a classification only.
      const message = err instanceof Error ? err.message : "";
      const providerStatus = message.match(/Brevo sendEmail failed (\d{3})/)?.[1];
      const ipBlocked = /unrecogni[sz]ed IP/i.test(message);
      req.log.error({ providerStatus, ipBlocked, environment }, "Admin test email failed");
      res.status(502).json({
        error: ipBlocked
          ? "Brevo blocked this server's IP address. Review Authorized IPs in Brevo and authorise the recognised server request."
          : providerStatus === "401"
            ? "Brevo rejected authentication. Check the email API key and Brevo security settings."
            : "Brevo did not confirm acceptance. Check Brevo Transactional Logs before retrying; delivery may be uncertain.",
      });
    }
  });

export default router;
