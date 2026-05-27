import app from "./app";
import { logger } from "./lib/logger";
import { assertStorageBucketConfigured } from "./lib/firebase-storage.js";

// Validate required configuration before accepting requests
assertStorageBucketConfigured();

// Remind operators that Firebase Storage security rules must be deployed so
// that logged-out visitors can read update media from the public feed.
// Rules live in storage.rules at the project root.
// Deploy with: pnpm --filter @workspace/scripts run deploy-storage-rules
// Or paste storage.rules into Firebase Console → Storage → Rules.
logger.info(
  "Firebase Storage rules: ensure storage.rules is deployed so updates/** is publicly readable. " +
  "Run: pnpm --filter @workspace/scripts run deploy-storage-rules",
);

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
