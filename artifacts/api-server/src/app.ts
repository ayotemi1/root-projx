import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger.js";
import "./lib/firebase-admin.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());

// ── CRITICAL: Stripe webhook must be registered BEFORE express.json() ─────────
// The webhook route uses express.raw() to get the raw Buffer for signature verification.
import webhooksRouter from "./routes/webhooks.js";
app.use(
  "/api",
  express.raw({ type: "application/json" }),
  webhooksRouter,
);

// ── JSON body parsing for all other routes ────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import router from "./routes/index.js";
app.use("/api", router);

export default app;
