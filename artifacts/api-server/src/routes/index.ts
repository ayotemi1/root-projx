import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import organisationsRouter from "./organisations.js";
import feedRouter from "./feed.js";
import followsRouter from "./follows.js";
import donationsRouter from "./donations.js";
import helpRouter from "./help.js";
import profileRouter from "./profile.js";
import newsletterRouter from "./newsletter.js";
import uploadsRouter from "./uploads.js";
import shopRouter from "./shop.js";
import stripeConnectRouter from "./stripe-connect.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organisationsRouter);
router.use(feedRouter);
router.use(followsRouter);
router.use(donationsRouter);
router.use(helpRouter);
router.use(profileRouter);
router.use(newsletterRouter);
router.use(uploadsRouter);
router.use(shopRouter);
router.use(stripeConnectRouter);

export default router;
