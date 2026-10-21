import { ExternalLink } from "lucide-react";
import type { WiseStatus } from "../lib/api";

export function WiseLastPayout({ status }: { status: WiseStatus }) {
  const { lastDisbursementAt, lastDisbursementAmountGbp, lastDisbursementTransferId } = status;
  const date = lastDisbursementAt ? new Date(lastDisbursementAt) : null;
  if (!date || !Number.isFinite(date.getTime()) ||
      typeof lastDisbursementAmountGbp !== "number" ||
      !Number.isFinite(lastDisbursementAmountGbp) || lastDisbursementAmountGbp <= 0) {
    return null;
  }

  const amount = new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(lastDisbursementAmountGbp);
  const paidOn = date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London",
  });

  return (
    <div className="space-y-1 text-xs text-muted-foreground" data-testid="wise-last-payout">
      <p>Last paid: {amount} on {paidOn}</p>
      {typeof lastDisbursementTransferId === "number" &&
        Number.isSafeInteger(lastDisbursementTransferId) && lastDisbursementTransferId > 0 && (
        <a
          href={`https://wise.com/transfers/${lastDisbursementTransferId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-primary"
          data-testid="link-wise-transfer"
        >
          Check transfer status on Wise <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
