import { useEffect, useState } from "react";
import { useSearch, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { storeConfirmedReceipt } from "@/lib/donor-identity";
import { donationDisclosure } from "@/lib/money-disclosure";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { currencyOf, currencySymbol } from "@/lib/currency";

export default function DonateSuccessPage() {
  const queryClient = useQueryClient();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id") ?? "";
  const [pollExpired, setPollExpired] = useState(false);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);

  useEffect(() => {
    setPollExpired(false);
    setPollStartedAt(null);
  }, [sessionId]);

  const confirmQ = useQuery({
    queryKey: ["donation-confirm", sessionId],
    queryFn: () => api.confirmDonation(sessionId),
    enabled: !!sessionId,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.data?.recorded === false && !pollExpired &&
      (pollStartedAt === null || Date.now() - pollStartedAt < 20_000)
        ? 2_000
        : false,
  });

  useEffect(() => {
    if (confirmQ.data?.recorded !== false || pollExpired) return;
    const startedAt = pollStartedAt ?? Date.now();
    if (pollStartedAt === null) setPollStartedAt(startedAt);
    const timeout = window.setTimeout(() => setPollExpired(true),
      Math.max(0, 20_000 - (Date.now() - startedAt)));
    return () => window.clearTimeout(timeout);
  }, [confirmQ.data?.recorded, pollExpired, pollStartedAt]);

  const donation = confirmQ.data;
  const waitingForRecord = donation?.recorded === false && !pollExpired;


  // Native-currency accounting when present; legacy confirmations are GBP top-level fields.
  type Acc = {
    amountGbp: number | null; chargedGbp?: number | null; intendedGbp?: number | null; platformFeeGbp?: number | null; feeCovered?: boolean;
    feeCoverGbp?: number | null; toOrgGbp?: number | null; estimatedStripeFeeGbp?: number | null; grossAmountGbp?: number | null; netAmountGbp?: number | null;
  };
  const extra = donation as (typeof donation & { currency?: string | null; receiptAccounting?: Acc | null }) | undefined;
  const native = extra?.receiptAccounting ?? null;
  const acc: Acc | undefined = native ?? donation;
  const displayedAmount = acc?.amountGbp ?? donation?.amountGbp;
  const currency = native ? currencyOf(extra?.currency) : "gbp";
  const sym = currencySymbol(currency);
  const receipt = donation?.recorded && acc && typeof acc.amountGbp === "number" && typeof acc.toOrgGbp === "number" && typeof acc.chargedGbp === "number"
    ? donationDisclosure({
        chargedGbp: acc.chargedGbp, intendedGbp: acc.intendedGbp ?? acc.amountGbp,
        platformFeeGbp: acc.platformFeeGbp ?? 0, feeCovered: !!acc.feeCovered,
        feeCoverGbp: acc.feeCoverGbp ?? 0, toOrgGbp: acc.toOrgGbp,
        estimatedStripeFeeGbp: acc.estimatedStripeFeeGbp ?? 0, amountGbp: acc.amountGbp,
        netAmountGbp: acc.netAmountGbp ?? acc.toOrgGbp, grossAmountGbp: acc.grossAmountGbp ?? acc.chargedGbp,
      }, donation.orgName, undefined, currency)
    : null;

  // Verified receipt handoff: only when confirm says recorded=true for this campaign.
  const verifiedAmount = donation?.recorded === true && typeof acc?.amountGbp === "number" ? acc.amountGbp : null;
  useEffect(() => {
    if (donation?.recorded === true && donation.campaignId) {
      storeConfirmedReceipt(donation.campaignId, { amount: verifiedAmount, currency });
    }
  }, [donation?.recorded, donation?.campaignId, verifiedAmount, currency]);

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["campaign-landing"] });
  }, [queryClient, sessionId, donation?.recorded]);

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center space-y-6">

        {/* Icon */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: "rgba(245,192,0,0.15)", border: "2px solid #F5C000" }}
        >
          {confirmQ.isLoading || waitingForRecord ? (
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle className="w-12 h-12" style={{ color: "#CC0000" }} />
          )}
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">Thank you!</h1>
          {donation && !waitingForRecord ? (
            <>
              <p className="text-muted-foreground text-base">
                Your donation of{" "}
                <strong className="text-foreground text-lg">
                  {typeof displayedAmount === "number" ? `${sym}${displayedAmount.toFixed(2)}` : "your gift"}
                </strong>{" "}
                to{" "}
                <strong className="text-foreground">{donation.orgName}</strong>{" "}
                was successful.
              </p>
            </>
          ) : waitingForRecord ? (
            <p className="text-muted-foreground">Payment successful. Finalising your receipt…</p>
          ) : confirmQ.isError ? (
            <p className="text-muted-foreground">
              We couldn't confirm this donation right now. Check your email for a receipt before trying to pay again.
            </p>
          ) : (
            <p className="text-muted-foreground">Confirming your donation…</p>
          )}
        </div>

        {donation?.recorded && donation.unit?.singular && (
          <div className="rounded-2xl border-2 border-accent bg-accent/10 px-5 py-4" data-testid="block-campaign-thanks">
            {donation.unit.imageUrl && <img src={donation.unit.imageUrl} alt="" className="w-12 h-12 mx-auto mb-2" />}
            <p className="font-extrabold text-lg text-foreground" data-testid="text-unit-added">
              You added one {donation.unit.singular}{donation.campaignName ? ` to ${donation.campaignName}` : ""}.
            </p>
            {donation.campaignPath && (
              <Link href={donation.campaignPath} className="mt-2 inline-block text-sm font-bold text-primary underline-offset-2 hover:underline" data-testid="link-see-your-unit">
                See your {donation.unit.singular} on the campaign
              </Link>
            )}
          </div>
        )}

        {receipt && (
          <div className="rounded-xl bg-secondary/60 px-5 py-3 text-xs text-muted-foreground space-y-1" data-testid="block-receipt-disclosure">
            <p>{receipt.donationLine}</p>
            <p>{receipt.orgLine}</p>
          </div>
        )}

        {/* Ongoing ask: secondary, below */}
        {donation?.recorded && donation.orgId && (
          <div className="rounded-xl border border-border px-5 py-4 text-sm text-left" data-testid="block-monthly-ask">
            <p className="text-muted-foreground">
              {donation.campaignId ? "This campaign ends. The work doesn't. " : ""}Support {donation.orgName} every month from £3.
            </p>
            <Link href={`/donate/${donation.orgId}?monthly=1`} className="mt-1 inline-block font-semibold text-primary underline-offset-2 hover:underline" data-testid="link-monthly-ask">
              Give monthly
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center pt-2">
          {donation?.campaignPath ? (
            <Link href={donation.campaignPath}>
              <Button variant="outline" data-testid="button-back-campaign">Back to campaign</Button>
            </Link>
          ) : donation?.orgId ? (
            <Link href={`/organisations/${donation.orgId}`}>
              <Button variant="outline">Back to Organisation</Button>
            </Link>
          ) : null}
          <Link href="/feed">
            <Button
              className="font-bold text-black"
              style={{ backgroundColor: "#F5C000" }}
            >
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
