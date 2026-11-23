import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { userErrorMessage } from "@/lib/error-feedback";
import { getAnonymousDonorId } from "@/lib/donor-identity";
import { currencyOf, currencySymbol, type CampaignCurrency } from "@/lib/currency";
import { CampaignDonatePanel, type DonateChoice, donationPence } from "@/components/campaign/campaign-donate-panel";
import "@/components/campaign/campaign-redesign.css";
import "./donation-amount-dialog.css";

interface Props {
  onClose: () => void;
  orgId: string;
  orgName: string;
  campaignId?: string;
  campaignName?: string;
  campaignPath?: string | null;
  currency?: CampaignCurrency | null;
  initialAmount?: number | null;
  initialFeeCovered?: boolean;
}

export async function beginDonationCheckout(input: {
  orgId: string; campaignId?: string; currency: CampaignCurrency;
  choice: DonateChoice; token?: string | null;
}) {
  const { intendedPence, feePence, chargedPence } = donationPence(input.choice.amount, input.choice.feeCovered, input.currency);
  const result = await api.createDonationCheckout({
    orgId: input.orgId, campaignId: input.campaignId, currency: input.currency, amountPence: chargedPence,
    originalAmountPence: intendedPence, feeAmountPence: feePence,
    feeCovered: input.choice.feeCovered, anonymousDonorId: getAnonymousDonorId(),
  }, input.token ?? undefined);
  if (!result.url) throw new Error("Checkout unavailable");
  window.location.assign(result.url);
}

export function DonationAmountDialog({ onClose, orgId, orgName, campaignId, campaignName, campaignPath, currency: requested, initialAmount, initialFeeCovered }: Props) {
  const { token } = useAuth();
  const campaignsQ = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: () => api.getCampaigns(orgId),
    enabled: !campaignId,
    staleTime: 30_000,
  });
  const current = !campaignId ? campaignsQ.data?.find(c => c.status === "active" && c.type === "fundraising" && c.enabled !== false && c.goal > 0) : null;
  const selectedCampaignId = campaignId ?? current?._id;
  const selectedCampaignName = campaignName ?? current?.name;
  const selectedCampaignPath = campaignPath ?? current?.sharePath ?? (current?.publicId ? `/campaigns/${current.publicId}` : null);
  const currency = currencyOf(campaignId ? requested : current?.currency);
  const [choice, setChoice] = useState<DonateChoice | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (busy) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function startCheckout(selected: DonateChoice) {
    if (busy) return;
    setChoice(selected);
    setError("");
    setBusy(true);
    try {
      await beginDonationCheckout({ orgId, campaignId: selectedCampaignId, currency, choice: selected, token });
    } catch (e) {
      setError(userErrorMessage(e, "start checkout"));
      setBusy(false);
    }
  }

  const amount = choice ? donationPence(choice.amount, choice.feeCovered, currency).chargedPence / 100 : null;
  return createPortal((
    <div className="rpd-backdrop" onClick={e => e.stopPropagation()} onMouseDown={(e) => { if (!busy && e.target === e.currentTarget) onClose(); }}>
      <div className="rc rpd-dialog" role="dialog" aria-modal="true" aria-label={`Donating to ${selectedCampaignName || orgName}`} data-testid="dialog-donate">
        <header className="rpd-head">
          <div>
            <span className="rc-mono">Donating to</span>
            <h2 className="rc-display">{selectedCampaignName || orgName}</h2>
            <p>{orgName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close donation pop-up" disabled={busy}><X size={21} /></button>
        </header>
        <div className="rpd-body">
          {!campaignId && campaignsQ.isLoading ? <p role="status">Finding the current campaign…</p> :
          !campaignId && campaignsQ.isError ? <p role="alert" className="rpd-error">Couldn't load the campaign. <button type="button" onClick={() => void campaignsQ.refetch()}>Try again</button></p> :
          <CampaignDonatePanel
            key={`${selectedCampaignId ?? orgId}-${initialAmount ?? 10}`}
            currency={currency} orgName={orgName} variant="popup"
            initialAmount={initialAmount} initialFeeCovered={initialFeeCovered}
            onDonate={startCheckout} onShare={() => {}}
          />}
          {error && <p role="alert" className="rpd-error">{error}</p>}
          {selectedCampaignPath && <Link href={selectedCampaignPath} onClick={onClose} className="rpd-link">See the full campaign</Link>}
        </div>
      </div>
      {busy && <div className="rpd-connecting" role="status" aria-live="polite">
        <span className="rpd-spinner" aria-hidden="true" />
        <strong className="rc-display">Connecting to Stripe…</strong>
        <p>Taking you to secure checkout for {currencySymbol(currency)}{amount?.toFixed(2)}.</p>
      </div>}
    </div>
  ), document.body);
}
