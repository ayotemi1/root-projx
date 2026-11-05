import { useId, useState } from "react";
import { ShieldCheck, Share2, CheckCircle } from "lucide-react";
import { calculateDonationAccounting, estimateStripeFeePence } from "../../../../api-server/src/lib/donation-accounting";
import { currencySymbol, type CampaignCurrency } from "@/lib/currency";

export const DONATE_BOX_ID = "campaign-donate-box";
export const DONATE_PRESETS = [3, 5, 10, 25, 50, 100];
const GOLD = "#F5B800";
const CREAM = "#F9F6F0";
const DEEP = "#7A0000";
const INK = "#1F1410";

export interface DonateChoice { amount: number; feeCovered: boolean }
export interface ConfirmedReceiptView { amount: number | null; currency: CampaignCurrency }

/** Scroll the hero donate box into view and move focus to it. Reduced-motion safe. */
export function focusDonateBox() {
  const el = document.getElementById(DONATE_BOX_ID);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  const target = el.querySelector<HTMLElement>("[data-donate-focus]") ?? el;
  target.focus({ preventScroll: true });
}

/** Charged/intended pence for a gift, using only the canonical accounting helpers. */
export function donationPence(amount: number, feeCovered: boolean, currency: CampaignCurrency) {
  const intendedPence = Math.round(amount * 100);
  const feePence = feeCovered ? estimateStripeFeePence(intendedPence, null, currency) : 0;
  return { intendedPence, feePence, chargedPence: intendedPence + feePence };
}

interface Props {
  currency: CampaignCurrency;
  orgName: string;
  heading?: string;
  cohortName?: string;
  preview?: boolean;
  receipt?: ConfirmedReceiptView | null;
  onDonate: (choice: DonateChoice) => void;
  onShare: () => void;
}

export function CampaignDonatePanel({ currency, orgName, heading = "Support this campaign", cohortName, preview = false, receipt, onDonate, onShare }: Props) {
  const sym = currencySymbol(currency);
  const ids = useId();
  const [preset, setPreset] = useState<number | "other">(10);
  const [other, setOther] = useState("");
  const [feeCovered, setFeeCovered] = useState(true);

  const money = (v: number) => `${sym}${v.toFixed(2)}`;
  const shortMoney = (v: number) => `${sym}${Number.isInteger(v) ? v : v.toFixed(2)}`;
  const amount = preset === "other" ? parseFloat(other) : preset;
  const valid = Number.isFinite(amount) && amount >= 3 && Number.isSafeInteger(Math.round(amount * 100));
  const showMinError = preset === "other" && other.trim() !== "" && !valid;
  const p = valid ? donationPence(amount, feeCovered, currency) : null;
  const acc = p ? calculateDonationAccounting({ chargedPence: p.chargedPence, intendedPence: p.intendedPence, feeCovered, currency }) : null;
  const feeEstimate = valid ? estimateStripeFeePence(Math.round(amount * 100), null, currency) / 100 : null;

  if (receipt) {
    return (
      <section id={DONATE_BOX_ID} tabIndex={-1} aria-labelledby={`${ids}-thanks`}
        className="rounded-2xl p-6 shadow-lg border-4 focus:outline-none" style={{ backgroundColor: CREAM, borderColor: GOLD, color: INK }}
        data-testid="panel-donate-thanks">
        <CheckCircle className="w-7 h-7" style={{ color: DEEP }} aria-hidden="true" />
        <h2 id={`${ids}-thanks`} data-donate-focus tabIndex={-1} className="mt-3 text-[1.5rem] leading-tight font-extrabold focus:outline-none">Your hand is on the wall.</h2>
        <p className="mt-2 text-[15px] leading-relaxed" data-testid="text-thanks-detail">
          {receipt.amount != null ? <>Your gift of <strong>{currencySymbol(receipt.currency)}{receipt.amount.toFixed(2)}</strong> has been recorded</> : <>Your gift has been recorded</>}
          {cohortName ? <> for {cohortName}.</> : <> for {orgName}.</>}
        </p>
        <button type="button" onClick={onShare}
          className="mt-5 w-full min-h-12 rounded-xl text-base font-bold inline-flex items-center justify-center gap-2 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ backgroundColor: GOLD, color: INK, outlineColor: DEEP }} data-testid="button-share-wall">
          <Share2 className="w-4 h-4" aria-hidden="true" /> Share the wall with your people
        </button>
      </section>
    );
  }

  return (
    <section id={DONATE_BOX_ID} tabIndex={-1} aria-labelledby={`${ids}-h`}
      className="rounded-2xl p-5 shadow-lg focus:outline-none" style={{ backgroundColor: CREAM, color: INK }} data-testid="panel-donate">
      <h2 id={`${ids}-h`} className="text-[1.4rem] leading-tight font-extrabold">{heading}</h2>
      {cohortName && <p className="text-[14px] text-[#5c4f45] mt-0.5" data-testid="text-donate-cohort">For {cohortName}</p>}

      <fieldset className="mt-4">
        <legend className="text-[13px] font-semibold mb-2">Choose an amount</legend>
        <div className="grid grid-cols-4 gap-2">
          {DONATE_PRESETS.map((v, i) => {
            const on = preset === v;
            return (
              <button key={v} type="button" aria-pressed={on} data-donate-focus={i === 2 ? "" : undefined}
                onClick={() => setPreset(v)}
                className="h-11 rounded-lg text-[15px] font-bold border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={on ? { backgroundColor: DEEP, borderColor: DEEP, color: CREAM, outlineColor: DEEP } : { backgroundColor: "#FFFDF8", borderColor: "#E0D6C6", color: INK, outlineColor: DEEP }}
                data-testid={`button-amount-${v}`}>
                {sym}{v}
              </button>
            );
          })}
          <button type="button" aria-pressed={preset === "other"} onClick={() => setPreset("other")}
            className="h-11 rounded-lg text-[15px] font-bold border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={preset === "other" ? { backgroundColor: DEEP, borderColor: DEEP, color: CREAM, outlineColor: DEEP } : { backgroundColor: "#FFFDF8", borderColor: "#E0D6C6", color: INK, outlineColor: DEEP }}
            data-testid="button-amount-other">
            Other
          </button>
        </div>
      </fieldset>

      {preset === "other" && (
        <div className="mt-3">
          <label htmlFor={`${ids}-other`} className="block text-[13px] font-semibold">Your amount in {currency === "usd" ? "dollars" : "pounds"}</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#5c4f45]" aria-hidden="true">{sym}</span>
            <input id={`${ids}-other`} type="number" inputMode="decimal" min={3} step="0.01" value={other} autoFocus
              onChange={(e) => setOther(e.target.value)}
              aria-invalid={showMinError} aria-describedby={showMinError ? `${ids}-min` : undefined}
              className="w-full h-11 rounded-lg border-2 pl-7 pr-3 text-[16px] font-semibold bg-[#FFFDF8] focus:outline-none"
              style={{ borderColor: showMinError ? "#B50000" : DEEP, fontFamily: "inherit" }}
              data-testid="input-amount-other" />
          </div>
          {showMinError && <p id={`${ids}-min`} role="alert" className="mt-1 text-[13px] font-semibold text-[#B50000]" data-testid="text-amount-min">The smallest gift is {sym}3.</p>}
        </div>
      )}

      <label className="mt-4 flex items-start gap-2.5 text-[14px] leading-snug cursor-pointer">
        <input type="checkbox" checked={feeCovered} onChange={(e) => setFeeCovered(e.target.checked)}
          className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: DEEP }} data-testid="checkbox-cover-fee" />
        <span>Cover the estimated card processing fee{feeEstimate != null ? ` (${money(feeEstimate)})` : ""} so it does not come out of the gift</span>
      </label>

      <dl className="mt-4 rounded-xl bg-[#FFFDF8] border border-[#E9E0D2] px-4 py-3 text-[14px] space-y-1.5" aria-live="polite" data-testid="list-donate-breakdown">
        <div className="flex justify-between gap-3"><dt>Your gift</dt><dd className="tabular-nums">{acc ? money(acc.intendedGbp) : "–"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Root ProjX platform fee (5%)</dt><dd className="tabular-nums">{acc ? money(acc.platformFeeGbp) : "–"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Card processing (estimated)</dt><dd className="tabular-nums text-right">{acc ? (feeCovered ? `${money(acc.feeCoverGbp)}, covered by you` : money(acc.estimatedStripeFeeGbp)) : "–"}</dd></div>
        <div className="flex justify-between gap-3 pt-1.5 border-t border-[#E9E0D2] font-bold"><dt>{orgName} receives</dt><dd className="tabular-nums" data-testid="text-org-receives">{acc ? money(acc.toOrgGbp) : "–"}</dd></div>
        <div className="flex justify-between gap-3 font-bold"><dt>You pay today</dt><dd className="tabular-nums" data-testid="text-total-charged">{acc ? money(acc.chargedGbp) : "–"}</dd></div>
      </dl>
      <p className="mt-1.5 text-[12px] text-[#5c4f45]">Card fees are an estimate; the exact Stripe fee depends on the card used.</p>

      <button type="button" disabled={!valid || preview} title={preview ? "Disabled in preview" : undefined}
        onClick={() => valid && onDonate({ amount, feeCovered })}
        className="mt-4 w-full min-h-[52px] rounded-xl text-[17px] font-bold hover:brightness-95 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={valid && !preview ? { backgroundColor: GOLD, color: INK, outlineColor: DEEP } : { backgroundColor: "#DDD5C8", color: "#5c4f45" }}
        data-testid="button-donate-campaign">
        {preview ? "Donations are off in preview" : valid ? `Donate ${shortMoney(amount)}` : `Choose ${sym}3 or more`}
      </button>
      <p className="mt-3 text-[13px] leading-snug text-[#5c4f45] flex gap-1.5">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-px" style={{ color: DEEP }} aria-hidden="true" />
        <span>One-off donation. Secure payment by Stripe. You choose at checkout whether your first name and last initial appear on the wall; otherwise you give anonymously.</span>
      </p>
    </section>
  );
}
