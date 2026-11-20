import { X, Heart } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  campaignId?: string;
  campaignName?: string;
  partnerFunding?: null;
  partnerFundingMatchedGbp?: number;
  currency?: "gbp" | "usd" | null;
}

/**
 * Isolated replacement for the checkout sheet: it keeps the page interaction
 * available without requesting payment data, invoking checkout, or navigating.
 */
export function GuestDonateSheet({ open, onClose, orgId: _orgId, orgName, campaignId, campaignName, currency }: Props) {
  if (!open) return null;
  const symbol = currency === "usd" && campaignId ? "$" : "£";
  return (
    <div
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Donation preview for ${campaignName || orgName}`}
        style={{
          position: "relative", background: "#fff", borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 480, padding: "24px", boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          aria-label="Close donation preview"
          onClick={onClose}
          style={{ position: "absolute", top: 18, right: 18, border: 0, background: "transparent", cursor: "pointer" }}
        >
          <X size={20} />
        </button>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "#777" }}>Donation preview · checkout disabled</p>
        <h2 style={{ margin: "0 32px 4px 0", fontSize: 22, fontWeight: 800 }}>
          {campaignId ? campaignName || "This campaign" : orgName}
        </h2>
        {campaignId && <p style={{ margin: "0 0 18px", color: "#777" }}>Supporting {orgName}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "20px 0" }}>
          {[5, 10, 25].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={(event) => {
                const buttons = event.currentTarget.parentElement?.querySelectorAll("button") ?? [];
                buttons.forEach((button) => {
                  button.style.background = button === event.currentTarget ? "#F5B800" : "#fafaf8";
                });
              }}
              style={{ padding: 12, border: "1px solid #e0d8cc", borderRadius: 10, background: amount === 25 ? "#F5B800" : "#fafaf8", fontWeight: 700 }}
            >
              {symbol}{amount}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled
          style={{ width: "100%", padding: 14, border: 0, borderRadius: 10, background: "#ccc", color: "#fff", fontWeight: 800 }}
        >
          <Heart size={15} fill="currentColor" style={{ verticalAlign: "middle", marginRight: 6 }} />
          Preview only — payment is not enabled
        </button>
      </section>
    </div>
  );
}
