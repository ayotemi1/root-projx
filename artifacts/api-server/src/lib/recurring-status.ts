export type RecurringStatus = "active" | "paused" | "past_due" | "canceled";

export function recurringStatus(
  stripeStatus: string,
  collectionPaused = false,
): RecurringStatus {
  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") return "canceled";
  if (stripeStatus === "paused" || collectionPaused) return "paused";
  if (stripeStatus === "past_due" || stripeStatus === "unpaid" || stripeStatus === "incomplete") return "past_due";
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  throw new Error(`Unsupported Stripe subscription status: ${stripeStatus}`);
}
