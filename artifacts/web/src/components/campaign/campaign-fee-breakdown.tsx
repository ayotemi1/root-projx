import { whereYourMoneyGoes } from "@/lib/money-disclosure";

/** Visual disclosure only; every monetary value comes from canonical accounting. */
export function CampaignFeeBreakdown({ orgName, colour, highlight = "#F5B82E", currency = "gbp" }: { orgName: string; colour: string; highlight?: string; currency?: "gbp" | "usd" }) {
  const { covered, uncovered } = whereYourMoneyGoes(orgName, 300, currency);
  const sym = currency === "usd" ? "$" : "£";
  return (
    <div className="flex flex-col gap-5" data-testid="campaign-fee-breakdown">
      <div className="rc-moneybars">
        {[covered, uncovered].map((accounting, i) => {
          const parts = [
            { name: orgName, value: accounting.toOrgGbp, colour },
            ...(!accounting.feeCovered ? [{ name: "Estimated card processing", value: accounting.estimatedStripeFeeGbp, colour: "#FFFDF9" }] : []),
            { name: "Root ProjX platform fee", value: accounting.platformFeeGbp, colour: highlight },
          ];
          return (
            <div key={i} className="min-w-0">
              <p className="m-0 mb-2 font-bold">{accounting.feeCovered ? "You cover the card fee" : "You don't cover the card fee"}</p>
              <div className="rc-moneybar" role="img" aria-label={parts.map(p => `${p.name}: ${sym}${p.value.toFixed(2)}`).join("; ")}>
                {parts.map(p => <span key={p.name} style={{ flexGrow: p.value, flexBasis: 0, backgroundColor: p.colour }} />)}
              </div>
              <p className="rc-moneyrow m-0">
                {parts.map(p => `${p.name}: ${sym}${p.value.toFixed(2)}`).join(" · ")}
              </p>
            </div>
          );
        })}
      </div>
      <p className="m-0 text-[15px] leading-relaxed" style={{ color: "var(--muted-dark)" }}>
        Card companies charge a fee on every payment. When you give, you choose whether to cover it, and you see the exact amounts before you pay.
      </p>
    </div>
  );
}
