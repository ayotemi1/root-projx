import Stripe from "stripe";

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  // Prefer direct env vars (set as Replit secrets) over the connector proxy
  if (process.env.STRIPE_SECRET_KEY) {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    };
  }

  // Fall back to Replit connector proxy
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) throw new Error("Stripe not configured: set STRIPE_SECRET_KEY secret or connect via Replit Stripe integration");

  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = await response.json() as {
    items?: Array<{ settings: { publishable: string; secret: string } }>;
  };

  const settings = data.items?.[0]?.settings;
  if (!settings?.publishable || !settings?.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found — set STRIPE_SECRET_KEY secret or connect via Replit Stripe integration`);
  }

  return { publishableKey: settings.publishable, secretKey: settings.secret };
}

// WARNING: Always call fresh — never cache
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}
