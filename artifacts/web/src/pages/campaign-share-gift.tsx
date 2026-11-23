import { useState } from "react";
import { Link, useParams, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { appFetch } from "@/lib/error-feedback";
import { CampaignSymbol } from "@/components/campaign-symbol";
import { DonationAmountDialog } from "@/components/donation-amount-dialog";
import { currencySymbol, currencyOf } from "@/lib/currency";
import { refreshShowcase } from "@/lib/supporter-showcase";
import "./campaign-thank-you.css";

type Choice = "post" | "involvement" | "private";
export default function CampaignShareGiftPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const sessionId = new URLSearchParams(useSearch()).get("session_id") ?? "";
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const landingQ = useQuery({ queryKey: ["share-gift-campaign", publicId], queryFn: () => api.getPublicCampaignLanding(publicId), enabled: !!publicId });
  const receiptQ = useQuery({ queryKey: ["donation-confirm", sessionId], queryFn: () => api.confirmDonation(sessionId), enabled: !!sessionId });
  const mineQ = useQuery({ queryKey: ["donations", "my", token], queryFn: () => api.getMyDonations(token!), enabled: !!token && user?.accountType === "supporter" });
  const [choice, setChoice] = useState<Choice>("post");
  const [text, setText] = useState<string | null>(null);
  const [showAmount, setShowAmount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [donateOpen, setDonateOpen] = useState(false);
  const campaign = landingQ.data?.campaign;
  const org = landingQ.data?.organisation;
  const gift = mineQ.data?.find(d => d.checkoutSessionId === sessionId && d._id === receiptQ.data?.donationId);
  const campaignPath = campaign?.sharePath || `/campaigns/${encodeURIComponent(publicId)}`;
  const thankYou = `/campaigns/${encodeURIComponent(publicId)}/thank-you?session_id=${encodeURIComponent(sessionId)}`;
  const owner = !!gift && !!receiptQ.data?.recorded && receiptQ.data.campaignId === campaign?._id && user?.accountType === "supporter";
  const copy = text ?? `I gave to ${campaign?.name ?? "a campaign"} with ${org?.name ?? "Root ProjX"}. Join me in supporting their work.`;
  async function submit() {
    if (!owner || !token || busy || (choice === "post" && (!copy.trim() || copy.length > 280))) return;
    setBusy(true); setError("");
    try {
      const res = await appFetch(`/api/donations/${encodeURIComponent(gift._id)}/sharing`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ choice, text: copy, showAmount }),
      });
      if (!res.ok) throw new Error("Sharing failed");
      const result = await res.json() as { postId: string | null };
      await Promise.all([
        refreshShowcase(qc),
        qc.invalidateQueries({ queryKey: ["donations", "my"] }),
      ]);
      window.location.assign(choice === "post" ? `/profile?post=${result.postId}` : choice === "involvement" ? "/profile?tab=involvement" : "/giving-history");
    } catch {
      setError("Something went wrong, please try again");
      setBusy(false);
    }
  }
  return <div className="rpt rpshare">
    {donateOpen && org && campaign && <DonationAmountDialog orgId={org._id} orgName={org.name}
      campaignId={campaign._id} campaignName={campaign.name} campaignPath={campaignPath}
      currency={campaign.currency} onClose={() => setDonateOpen(false)} />}
    <header className="rpt-top"><span className="rpt-logo">{org?.name?.slice(0, 3).toUpperCase() ?? "RPX"}</span><span>{org?.name || "Organisation"}<small>on Root ProjX</small></span></header>
    <main className="rpshare-main">
      {landingQ.isLoading || receiptQ.isLoading || mineQ.isLoading ? <p>Loading your gift…</p>
        : !owner ? <><h1>This gift is private</h1><p>Sign in with the account that made this donation to choose how to share it.</p><Link href={thankYou}>Back</Link></>
          : <>
            <span className="rpt-mono">Share your gift · optional</span>
            <h1>How do you want to share it?</h1>
            <p>Nothing goes on your profile unless you choose it here.</p>
            <div className="rpshare-options">
              <label className="rpshare-option"><input type="radio" name="share" checked={choice === "post"} onChange={() => setChoice("post")} /><span><strong>Post it</strong><small>A text post on your profile and in your followers' feeds. It's also added to your Involvement.</small></span></label>
              {choice === "post" && <div className="rpshare-expanded">
                <div className="rpshare-author"><span>{user?.name?.slice(0, 2).toUpperCase()}</span>{user?.name} · gave to {campaign?.name}</div>
                <textarea value={copy} onChange={e => setText(e.target.value)} maxLength={280} aria-label="Share post text" />
                <span className="rpt-mono">{copy.length}/280</span>
                <button type="button" onClick={() => setDonateOpen(true)} className="rpshare-campaign w-full text-left"><CampaignSymbol campaign={campaign} className="w-10 h-10 shrink-0" /> <span><b>{campaign?.name}</b><small>{org?.name} · Support the campaign</small></span></button>
                <label className="rpshare-switch">Show the amount ({currencySymbol(currencyOf(gift.currency))}{(gift.receiptAccounting?.intendedGbp ?? gift.amountGbp)?.toFixed(2)})
                  <input type="checkbox" checked={showAmount} onChange={e => setShowAmount(e.target.checked)} role="switch" />
                </label>
              </div>}
              <label className="rpshare-option"><input type="radio" name="share" checked={choice === "involvement"} onChange={() => setChoice("involvement")} /><span><strong>Add it to my Involvement</strong><small>A quiet record on your profile. Nothing appears in anyone's feed.</small></span></label>
              {choice === "involvement" && <div className="rpshare-expanded">
                <div className="rpshare-campaign"><CampaignSymbol campaign={campaign} className="w-10 h-10 shrink-0" /><span><b>Supporter · {campaign?.name}</b><small>{org?.name}</small><small>Donation · {new Date(gift.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</small></span></div>
                <small>The amount is never shown.</small>
              </div>}
              <label className="rpshare-option"><input type="radio" name="share" checked={choice === "private"} onChange={() => setChoice("private")} /><span><strong>Keep it private</strong><small>Only you can see it, in your Giving history.</small></span></label>
            </div>
            {error && <p role="alert" className="rpshare-error">{error}</p>}
            <div className="rpt-actions"><button className="rpt-button" type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : choice === "post" ? "Post it →" : choice === "involvement" ? "Add to my Involvement →" : "Done"}</button><Link href={thankYou}>Back</Link></div>
          </>}
    </main>
  </div>;
}
