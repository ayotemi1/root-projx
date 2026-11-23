import { useEffect, useState, type CSSProperties } from "react";
import { Link, useParams, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { appFetch } from "@/lib/error-feedback";
import * as api from "@/lib/api";
import { currencyOf, currencySymbol } from "@/lib/currency";
import { storeConfirmedReceipt } from "@/lib/donor-identity";
import { CampaignSymbol, campaignPresentation, campaignCounter } from "@/components/campaign-symbol";
import { beginDonationCheckout } from "@/components/donation-amount-dialog";
import { campaignColours } from "@/components/campaign/campaign-page-view";
import "./campaign-thank-you.css";

type Status = { status: "paid" | "pending" | "failed"; campaignId: string | null; amount: number; feeCovered: boolean };
const getStatus = async (id: string): Promise<Status> => {
  const res = await appFetch(`/api/donations/checkout-status?session_id=${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Status unavailable");
  return res.json();
};
export default function CampaignThankYouPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const sessionId = new URLSearchParams(useSearch()).get("session_id") ?? "";
  const { user, token } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const qc = useQueryClient();
  const campaignQ = useQuery({
    queryKey: ["thank-you-campaign", publicId],
    queryFn: () => api.getPublicCampaignLanding(publicId),
    enabled: !!publicId,
  });
  const statusQ = useQuery({
    queryKey: ["checkout-status", sessionId],
    queryFn: () => getStatus(sessionId),
    enabled: !!sessionId,
    refetchInterval: q => q.state.data?.status === "pending" ? 2500 : false,
    retry: 1,
  });
  const confirmedQ = useQuery({
    queryKey: ["donation-confirm", sessionId],
    queryFn: () => api.confirmDonation(sessionId),
    enabled: !!sessionId && statusQ.data?.status === "paid",
    refetchInterval: q => q.state.data?.recorded === false ? 2000 : false,
    retry: 1,
  });
  const landing = campaignQ.data;
  const receipt = confirmedQ.data;
  const validCampaign = !!landing && statusQ.data?.campaignId === landing.campaign._id &&
    (!receipt || receipt.campaignId === landing.campaign._id);
  const campaignPath = landing?.campaign.sharePath || (landing ? `/campaigns/${encodeURIComponent(publicId)}` : "/discover");
  const paid = statusQ.data?.status === "paid" && receipt?.recorded && validCampaign;
  const pending = !statusQ.data || statusQ.data.status === "pending" || (statusQ.data.status === "paid" && !paid);
  const currency = currencyOf(receipt?.currency);
  const native = receipt?.receiptAccounting;
  const isSupporter = user?.accountType === "supporter";
  const first = isSupporter ? user.name?.trim().split(/\s+/)[0] : "";
  const campaignAccent = campaignColours(landing?.campaign.theme).accent;
  const presentation = campaignPresentation(landing?.campaign);
  async function retryCheckout() {
    if (!landing || !statusQ.data || retrying) return;
    setRetrying(true); setRetryError("");
    try {
      await beginDonationCheckout({
        orgId: landing.organisation._id, campaignId: landing.campaign._id,
        currency: currencyOf(landing.campaign.currency), token,
        choice: { amount: statusQ.data.amount, feeCovered: statusQ.data.feeCovered },
      });
    } catch {
      setRetryError("Something went wrong, please try again");
      setRetrying(false);
    }
  }

  useEffect(() => {
    if (!paid || !receipt?.campaignId) return;
    storeConfirmedReceipt(receipt.campaignId, { amount: native?.intendedGbp ?? null, currency });
    void qc.invalidateQueries({ queryKey: ["campaign-landing"] });
    void qc.invalidateQueries({ queryKey: ["donations", "my"] });
  }, [paid, receipt?.campaignId, native?.intendedGbp, currency, qc]);

  if (!sessionId || statusQ.isError || campaignQ.isError || (landing && statusQ.data && !validCampaign)) {
    return <main className="rpt rpd-state"><h1>We couldn't confirm this gift</h1><p>Please check your receipt email before trying again.</p><Link href={campaignPath}>Back to the campaign</Link></main>;
  }
  return <div className={`rpt ${paid ? "" : "rpd-state"}`} style={{ "--red": campaignAccent } as CSSProperties}>
    <header className="rpt-top"><span className="rpt-logo">{landing?.organisation.name?.slice(0, 3).toUpperCase() || "RPX"}</span><span>{landing?.organisation.name || "Organisation"}<small>on Root ProjX</small></span></header>
    <main className="rpt-main">
      {statusQ.data?.status === "failed" ? <>
        {landing && <CampaignSymbol campaign={landing.campaign} className="rpt-hand rpt-faded" />}
        <span className="rpt-mono">Payment not completed</span>
        <h1>That didn't go through</h1>
        <p>You haven't been charged. Please try again when you're ready.</p>
        <button type="button" disabled={retrying} className="rpt-button rpt-yellow" onClick={retryCheckout}>{retrying ? "Connecting to Stripe…" : "Try again"}</button>
        {retryError && <p role="alert">{retryError}</p>}
        <Link href={campaignPath}>Back to the campaign</Link>
      </> : pending ? <>
        <span className="rpt-spinner" aria-hidden="true" />
        <span className="rpt-mono">Payment processing</span>
        <h1>Almost there</h1>
        <p>We'll email your receipt when it's confirmed. You don't need to do anything.</p>
        <Link href={campaignPath}>Back to the campaign</Link>
      </> : <>
        <CampaignSymbol campaign={landing?.campaign} className="rpt-hand" />
        <span className="rpt-mono">{campaignCounter(landing?.campaign, receipt?.wallNumber)}</span>
        <h1>Thank you{first ? <>, <em>{first}</em></> : null}</h1>
        <p>Your gift to <strong>{landing?.campaign.name}</strong> is confirmed{presentation.confirmationLine ? `, ${presentation.confirmationLine}` : ""}.</p>
        <p className="rpt-quiet">{currencySymbol(currency)}{native?.intendedGbp?.toFixed(2)} given · {currencySymbol(currency)}{native?.toOrgGbp?.toFixed(2)} reaches {receipt?.orgName} · Receipt sent to {receipt?.donorEmail}</p>
        {isSupporter ? <>
          <div className="rpt-actions"><Link className="rpt-button" href={`/campaigns/${encodeURIComponent(publicId)}/thank-you/share?session_id=${encodeURIComponent(sessionId)}`}>Share my donation →</Link><Link href={campaignPath}>Keep it private</Link></div>
          <span className="rpt-hint">Private unless you choose to share it. Saved in your Giving history.</span>
        </> : <>
          <div className="rpt-actions"><Link className="rpt-button" href={`/register?next=${encodeURIComponent(campaignPath)}`}>Create an account →</Link><Link href={campaignPath}>Back to the campaign</Link></div>
          <span className="rpt-hint">Follow {landing?.organisation.name}'s updates and keep a record of your giving.</span>
        </>}
      </>}
    </main>
  </div>;
}
