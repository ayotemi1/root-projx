import { appFetch as fetch, userErrorMessage } from "@/lib/error-feedback";
import { useEffect, useState } from "react";
import { GuestDonorWallChoice } from "./guest-donor-wall-choice";
import { Link } from "wouter";
import { X, Heart } from "lucide-react";
import { partnerMatch, ratioLabel } from "@/lib/partner-funding";
import type { PartnerFunding } from "@/lib/api";
import { currencyOf, currencySymbol, type CampaignCurrency } from "@/lib/currency";
import { getAnonymousDonorId } from "@/lib/donor-identity";
import { calculateDonationAccounting, donationDisclosure, estimateStripeFeePence } from "../../../api-server/src/lib/donation-accounting";

const RED = "#B50000";
const GOLD = "#F5B800";
const PRESETS = [3, 5, 10, 25, 50, 100];

interface Props {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  campaignId?: string;
  campaignName?: string;
  /** Partner funding. Display only — never added to the charge or accounting. */
  partnerFunding?: PartnerFunding | null;
  /** Server-owned matching funds already allocated. */
  partnerFundingMatchedGbp?: number;
  /** Campaign charge currency. Organisation gifts are always GBP. */
  currency?: CampaignCurrency | null;
  /** Amount chosen on the campaign page, so nothing resets at this step. */
  initialAmount?: number | null;
  /** Fee-cover choice from the campaign page. */
  initialFeeCovered?: boolean;
}

export function guestCheckoutBody(orgId: string, amountPence: number, campaignId: string | undefined, anonymousDonorId?: string, wallOptIn = false, donorName = "", currency: CampaignCurrency = "gbp", feeCovered = false) {
  // Fee cover: charge gift + canonical estimated Stripe fee; the server keeps the platform fee on the gift.
  const feePence = feeCovered ? estimateStripeFeePence(amountPence, null, currency) : 0;
  return { orgId, amountPence: amountPence + feePence, currency, ...(campaignId ? { campaignId } : {}), anonymousDonorId,
    ...(feeCovered ? { feeCovered: true, originalAmountPence: amountPence, feeAmountPence: feePence } : {}),
    ...(wallOptIn ? { wallOptIn: true, donorName: donorName.trim() } : {}) };
}

export function GuestDonateSheet({ open, onClose, orgId, orgName, campaignId, campaignName, partnerFunding, partnerFundingMatchedGbp, currency: currencyProp, initialAmount, initialFeeCovered = false }: Props) {
  const currency = currencyOf(campaignId ? currencyProp : "gbp");
  const sym = currencySymbol(currency);
  const [preset, setPreset] = useState<number>(() => initialAmount && initialAmount > 0 ? (PRESETS.includes(initialAmount) ? initialAmount : 0) : 25);
  const [custom, setCustom] = useState(() => initialAmount && initialAmount > 0 && !PRESETS.includes(initialAmount) ? String(initialAmount) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wallOptIn, setWallOptIn] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [feeCovered, setFeeCovered] = useState(initialFeeCovered);

  useEffect(() => {
    if (!open) return;
    setFeeCovered(initialFeeCovered);
    if (initialAmount && initialAmount > 0) {
      if (PRESETS.includes(initialAmount)) { setPreset(initialAmount); setCustom(""); }
      else { setPreset(0); setCustom(String(initialAmount)); }
    }
  }, [open, initialAmount, initialFeeCovered]);

  if (!open) return null;

  const amountGbp = custom ? parseFloat(custom) : preset;
  const amountPence = Math.round((amountGbp || 0) * 100);
  const valid = Number.isSafeInteger(amountPence) && amountGbp >= 3;
  const accounting = Number.isSafeInteger(amountPence) && amountPence > 0
    ? calculateDonationAccounting(feeCovered
      ? { chargedPence: amountPence + estimateStripeFeePence(amountPence, null, currency), intendedPence: amountPence, feeCovered: true, currency }
      : { chargedPence: amountPence, feeCovered: false, currency }) : null;
  const isMatching = partnerFunding?.type === "matching";
  const matchState = partnerMatch(valid ? amountGbp : 0, partnerFunding, partnerFundingMatchedGbp ?? 0);
  const matchExhausted = isMatching && matchState.availableGbp <= 0;
  const boost = valid ? matchState.matchedGbp : 0;
  const disclosure = accounting ? donationDisclosure(accounting, orgName, undefined, currency) : null;
  const donationPath = `/donate/${orgId}${campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : ""}`;

  function handleClose() {
    setPreset(25);
    setCustom("");
    setError("");
    setLoading(false);
    setWallOptIn(false); setDonorName("");
    setFeeCovered(initialFeeCovered);
    onClose();
  }

  async function handleDonate() {
    if (!valid || loading) return;
    if (wallOptIn && !donorName.trim()) { setError("Enter your name or leave name sharing unchecked."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/donations/anonymous-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guestCheckoutBody(orgId, amountPence, campaignId, getAnonymousDonorId(), wallOptIn, donorName, currency, feeCovered)),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(userErrorMessage({ message: data.error, status: res.status }, "start checkout"));
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (error) {
      setError(userErrorMessage(error, "start checkout"));
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "0 0 40px",
          animation: "guestSheetUp 0.22s ease",
        }}
      >
        <style>{`@keyframes guestSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

        {/* Header */}
        <div style={{ background: RED, padding: "22px 24px 20px", position: "relative", borderRadius: "20px 20px 0 0" }}>
          <button
            onClick={handleClose}
            style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", padding: 4 }}
          >
            <X size={20} />
          </button>
          <p style={{ margin: "0 0 2px", fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>Donating to</p>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff", paddingRight: 32, lineHeight: 1.25 }}>{campaignId ? campaignName || "This campaign" : orgName}</h2>
          {campaignId && <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.8)" }}>{orgName}</p>}
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>No account needed · Secured by Stripe</p>
        </div>

        <div style={{ padding: "24px 24px 0" }}>

          {/* Amount presets */}
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Choose an amount
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
            {PRESETS.map((amt) => {
              const active = preset === amt && !custom;
              return (
                <button
                  key={amt}
                  onClick={() => { setPreset(amt); setCustom(""); setError(""); }}
                  style={{
                    padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 17,
                    border: active ? "2px solid transparent" : "2px solid #e0d8cc",
                    background: active ? GOLD : "#fafaf8",
                    color: active ? "#111" : "#333",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {sym}{amt}
                </button>
              );
            })}
            <button
              onClick={() => { setCustom(custom || ""); setPreset(0); setError(""); }}
              style={{
                padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 14,
                border: custom || preset === 0 ? `2px solid ${RED}` : "2px solid #e0d8cc",
                background: "#fafaf8", color: "#555",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              Custom
            </button>
          </div>

          {/* Custom amount input */}
          {(custom !== "" || preset === 0) && (
            <div style={{ position: "relative", marginBottom: 10 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "#888", fontSize: 17 }}>{sym}</span>
              <input
                type="number"
                min="3"
                step="1"
                placeholder="0"
                autoFocus
                value={custom}
                onChange={(e) => { setCustom(e.target.value); setError(""); }}
                style={{
                  width: "100%", padding: "12px 14px 12px 32px", fontSize: 17, fontWeight: 700,
                  border: `2px solid ${RED}`, borderRadius: 10, outline: "none",
                  background: "#fff", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </div>
          )}

          {boost > 0 && (
            <div data-testid="block-match-boost" style={{ border: `2px solid ${GOLD}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10, background: "#FFFBEB" }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111" }} data-testid="text-match-boost">
                {sym}{amountGbp.toFixed(amountGbp % 1 ? 2 : 0)} <span style={{ color: RED }}>→</span> {sym}{(amountGbp + boost).toFixed((amountGbp + boost) % 1 ? 2 : 0)} <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>toward the programme</span>
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
                Your own {sym}{amountGbp.toFixed(amountGbp % 1 ? 2 : 0)} + {sym}{boost.toFixed(boost % 1 ? 2 : 0)} from {partnerFunding?.funderName || "the funder"}'s matching pledge ({ratioLabel(partnerFunding!, currency)}{boost < amountGbp * (partnerFunding?.matchRatio || 1) ? `, limited to the ${sym}${matchState.availableGbp.toFixed(2)} still available` : ""}). Matching depends on what is still available when your payment succeeds. You are charged {sym}{(accounting?.chargedGbp ?? amountGbp).toFixed(2)}.
              </p>
            </div>
          )}
          {matchExhausted && (
            <p data-testid="text-match-claimed" style={{ fontSize: 12, color: "#555", margin: "0 0 10px" }}>Matching has been fully claimed.</p>
          )}

          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, margin: "0 0 12px", cursor: "pointer" }}>
            <input type="checkbox" checked={feeCovered} onChange={(e) => setFeeCovered(e.target.checked)} data-testid="checkbox-sheet-cover-fee" style={{ marginTop: 2, accentColor: "#7A0000" }} />
            <span>Cover the estimated card processing fee{valid ? ` (${sym}${(estimateStripeFeePence(amountPence, null, currency) / 100).toFixed(2)})` : ""} so it does not come out of the gift</span>
          </label>
          <GuestDonorWallChoice optedIn={wallOptIn} name={donorName} onOptIn={setWallOptIn} onName={setDonorName} />
          {/* Summary */}
          {amountGbp > 0 && (
            <div style={{ background: "rgba(245,184,0,0.1)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#777" }}>{disclosure?.donationLine}</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#aaa" }}>
                {disclosure?.orgLine}
              </p>
            </div>
          )}

          {error && (
            <p style={{ margin: "0 0 10px", fontSize: 13, color: RED, textAlign: "center" }}>{error}</p>
          )}

          {/* Donate CTA */}
          <button
            onClick={handleDonate}
            disabled={!valid || loading}
            style={{
              width: "100%", padding: "15px", borderRadius: 12, border: "none",
              background: !valid || loading ? "#ccc" : RED,
              color: "#fff", fontWeight: 800, fontSize: 16,
              cursor: !valid || loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.2s",
            }}
          >
            <Heart size={16} fill="currentColor" />
            {loading
              ? "Redirecting to Stripe…"
              : valid
                ? `Donate ${sym}${(accounting?.chargedGbp ?? amountGbp).toFixed(2)} — no sign-up needed`
                : "Choose an amount"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
            <div style={{ flex: 1, height: 1, background: "#e0d8cc" }} />
            <span style={{ fontSize: 12, color: "#bbb" }}>or sign in to track your impact</span>
            <div style={{ flex: 1, height: 1, background: "#e0d8cc" }} />
          </div>

          {/* Auth links */}
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/register?next=${encodeURIComponent(donationPath)}`}
              onClick={handleClose}
              style={{ flex: 1 }}
            >
              <button
                style={{
                  width: "100%", padding: "11px", borderRadius: 10, border: `2px solid ${GOLD}`,
                  background: GOLD, color: "#111", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                Create account
              </button>
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(donationPath)}`}
              onClick={handleClose}
              style={{ flex: 1 }}
            >
              <button
                style={{
                  width: "100%", padding: "11px", borderRadius: 10, border: `2px solid ${RED}`,
                  background: "transparent", color: RED, fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                Sign in
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
