import { Router } from "express";
import { ReadSupporterNotificationParams } from "@workspace/api-zod";
import { requireAuth, requireApprovedOrganisation } from "../lib/auth.js";
import { fsMarkSupporterNotificationRead, getServerToken } from "../lib/firebase-rest.js";
import { loadSupporterNotifications } from "../lib/supporter-notifications.js";
import { loadOrganisationNotifications } from "../lib/organisation-notifications.js";

const router = Router();
router.use("/supporter-notifications", requireAuth, (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Authorization");
  if (req.user!.accountType === "organisation") { void requireApprovedOrganisation(req, res, next); return; }
  if (req.user!.accountType !== "supporter") {
    res.status(403).json({ error: "Notifications are available to signed-in supporters." }); return;
  }
  next();
});

router.get("/supporter-notifications", async (req, res): Promise<void> => {
  try {
    res.json(req.user!.accountType === "organisation" ? await loadOrganisationNotifications(req.user!.userId)
      : await loadSupporterNotifications(req.user!.userId, req.headers.authorization!.slice(7)));
  } catch {
    req.log.error("Could not load private supporter notifications");
    res.status(503).json({ error: "We couldn't load your notifications. Please try again." });
  }
});

router.post("/supporter-notifications/:id/read", async (req, res): Promise<void> => {
  const params = ReadSupporterNotificationParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "This notification is no longer available." }); return;
  }
  try {
    const uid = req.user!.userId;
    const inbox = req.user!.accountType === "organisation" ? await loadOrganisationNotifications(uid)
      : await loadSupporterNotifications(uid, req.headers.authorization!.slice(7));
    const item = inbox.items.find(row => row.id === params.data.id);
    if (!item) {
      res.status(404).json({ error: "This notification is no longer available." }); return;
    }
    if (!item.read) await fsMarkSupporterNotificationRead(uid, item.id, await getServerToken());
    item.read = true;
    inbox.unreadCount = inbox.items.filter(row => !row.read).length;
    res.json(inbox);
  } catch {
    req.log.error("Could not mark private supporter notification read");
    res.status(503).json({ error: "We couldn't open this notification. Please try again." });
  }
});

export default router;
