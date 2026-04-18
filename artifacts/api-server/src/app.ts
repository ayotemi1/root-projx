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

// ── CRITICAL: Stripe webhook — raw body ONLY on this exact path ────────────────
// Must be mounted BEFORE express.json() so the raw Buffer is available for
// Stripe signature verification. express.raw() must NOT apply to other routes.
import webhooksRouter from "./routes/webhooks.js";
app.use(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  webhooksRouter,
);

// ── JSON body parsing for all other routes ────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import router from "./routes/index.js";
app.use("/api", router);

export default app;
