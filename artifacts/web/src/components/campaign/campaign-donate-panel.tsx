import { useId, useRef, useState } from "react";
import { ShieldCheck, Share2, CheckCircle, ArrowRight } from "lucide-react";
import { calculateDonationAccounting, estimateStripeFeePence } from "../../../../api-server/src/lib/donation-accounting";
import { currencySymbol, type CampaignCurrency } from "@/lib/currency";

export const DONATE_BOX_ID = "campaign-donate-box";
export const DONATE_PRESETS = [3, 5, 10, 25, 50, 100];

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
  variant?: "page" | "popup";
  initialAmount?: number | null;
  initialFeeCovered?: boolean;
}

/** Rendered inside the page's give bento; colours come from the page's --rc-accent / --rc-hi. */
export function CampaignDonatePanel({ currency, orgName, heading = "Support this campaign", cohortName, preview = false, receipt, onDonate, onShare, variant = "page", initialAmount, initialFeeCovered = true }: Props) {
  const sym = currencySymbol(currency);
  const ids = useId();
  const otherRef = useRef<HTMLInputElement>(null);
  const [preset, setPreset] = useState<number | "other">(
    initialAmount && !DONATE_PRESETS.includes(initialAmount) ? "other" : initialAmount ?? 10,
  );
  const [other, setOther] = useState(initialAmount && !DONATE_PRESETS.includes(initialAmount) ? String(initialAmount) : "");
  const [feeCovered, setFeeCovered] = useState(initialFeeCovered);

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
      <section id={DONATE_BOX_ID} tabIndex={-1} aria-labelledby={`${ids}-thanks`} className="rc-donate rc-thanks" data-testid="panel-donate-thanks">
        <p className="rc-mono rc-muted inline-flex items-center gap-2"><CheckCircle className="w-4 h-4" style={{ color: "var(--rc-accent)" }} aria-hidden="true" /> Gift recorded</p>
        <h2 id={`${ids}-thanks`} data-donate-focus tabIndex={-1} className="rc-display focus:outline-none">Your hand is on the wall.</h2>
        <p className="m-0 text-[15px] leading-relaxed" data-testid="text-thanks-detail">
          {receipt.amount != null ? <>Your gift of <strong>{currencySymbol(receipt.currency)}{receipt.amount.toFixed(2)}</strong> has been recorded</> : <>Your gift has been recorded</>}
          {cohortName ? <> for {cohortName}.</> : <> for {orgName}.</>}
        </p>
        <button type="button" onClick={onShare} className="rc-give-btn mt-auto" style={{ background: "var(--rc-hi)", borderColor: "var(--rc-hi)", color: "var(--ink)" }} data-testid="button-share-wall">
          <Share2 className="w-4 h-4" aria-hidden="true" /> Share the wall with your people
        </button>
      </section>
    );
  }

  const pickOther = () => { setPreset("other"); otherRef.current?.focus(); };

  return (
    <section id={variant === "popup" ? undefined : DONATE_BOX_ID} tabIndex={-1} aria-labelledby={`${ids}-h`} className={`rc-donate ${variant === "popup" ? "rc-donate-popup" : ""}`} data-testid="panel-donate">
      <div>
        <p id={`${ids}-h`} className="rc-mono rc-muted m-0" data-testid="text-donate-heading">{variant === "popup" ? "Choose an amount" : heading}</p>
        {variant !== "popup" && <h2 className="rc-display">Choose an amount</h2>}
        {cohortName && <p className="mt-2 mb-0 text-[14px] rc-muted" data-testid="text-donate-cohort">For {cohortName}</p>}
      </div>

      <fieldset className="m-0 p-0 border-0 min-w-0">
        <legend className="rc-sr">Choose an amount</legend>
        <div className="rc-amounts">
          {DONATE_PRESETS.map((v, i) => (
            <button key={v} type="button" aria-pressed={preset === v} data-donate-focus={i === 2 ? "" : undefined}
              onClick={() => setPreset(v)} data-testid={`button-amount-${v}`}>
              {sym}{v}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <div className={`rc-other ${preset === "other" ? "is-on" : ""} ${showMinError ? "is-bad" : ""}`}>
          <button type="button" className="rc-other-btn" aria-pressed={preset === "other"} onClick={pickOther} data-testid="button-amount-other">
            Other amount {sym}
          </button>
          <label htmlFor={`${ids}-other`} className="rc-sr">Your amount in {currency === "usd" ? "dollars" : "pounds"}</label>
          <input ref={otherRef} id={`${ids}-other`} type="number" inputMode="decimal" min={3} step="0.01" value={other}
            placeholder={currency === "usd" ? "e.g. 150" : "e.g. 15"}
            onFocus={() => setPreset("other")}
            onChange={(e) => { setPreset("other"); setOther(e.target.value); }}
            aria-invalid={showMinError} aria-describedby={showMinError ? `${ids}-min` : undefined}
            data-testid="input-amount-other" />
        </div>
        {showMinError && <p id={`${ids}-min`} role="alert" className="mt-1.5 mb-0 text-[13px] font-semibold text-[#A3000B]" data-testid="text-amount-min">The smallest gift is {sym}3.</p>}
      </div>

      <label className="rc-cover">
        <input type="checkbox" checked={feeCovered} onChange={(e) => setFeeCovered(e.target.checked)} data-testid="checkbox-cover-fee" />
        <span>Cover the estimated card processing fee{feeEstimate != null ? ` (${money(feeEstimate)})` : ""} so it does not come out of the gift</span>
      </label>

      <dl className="rc-rows" aria-live="polite" data-testid="list-donate-breakdown">
        <div><dt>Your gift</dt><dd>{acc ? money(acc.intendedGbp) : "–"}</dd></div>
        <div><dt>Root ProjX platform fee (5%)</dt><dd>{acc ? money(acc.platformFeeGbp) : "–"}</dd></div>
        <div><dt>Card processing (estimated)</dt><dd>{acc ? (feeCovered ? `${money(acc.feeCoverGbp)}, covered by you` : money(acc.estimatedStripeFeeGbp)) : "–"}</dd></div>
        <div className="b"><dt>{orgName} receives</dt><dd data-testid="text-org-receives">{acc ? money(acc.toOrgGbp) : "–"}</dd></div>
        <div className="b"><dt>You pay today</dt><dd data-testid="text-total-charged">{acc ? money(acc.chargedGbp) : "–"}</dd></div>
      </dl>

      <button type="button" disabled={!valid || preview} title={preview ? "Disabled in preview" : undefined}
        onClick={() => valid && onDonate({ amount, feeCovered })}
        className="rc-give-btn" data-testid="button-donate-campaign">
        {preview ? "Donations are off in preview" : valid ? `Give ${shortMoney(p!.chargedPence / 100)}` : `Choose ${sym}3 or more`}
        {valid && !preview && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
      </button>
      <p className="rc-small">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-px" style={{ color: "var(--ink)" }} aria-hidden="true" />
        <span>One-off gift. Secure payment by Stripe. At checkout you choose whether your first name and last initial appear on the wall. Card fees are estimated.</span>
      </p>
    </section>
  );
}
