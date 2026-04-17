// Stripe webhook processing via stripe-replit-sync
import { getStripeSync } from "./stripeClient.js";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const stripeSync = await getStripeSync();
    await stripeSync.processWebhook(payload, signature);
  }
}
