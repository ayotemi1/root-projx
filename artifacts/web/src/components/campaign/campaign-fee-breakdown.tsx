import { whereYourMoneyGoes } from "@/lib/money-disclosure";

/** Visual disclosure only; every monetary value comes from canonical accounting. */
export function CampaignFeeBreakdown({ orgName, colour }: { orgName: string; colour: string }) {
  const { covered, uncovered } = whereYourMoneyGoes(orgName);
  return (
    <div className="space-y-4" data-testid="campaign-fee-breakdown">
      {[covered, uncovered].map((accounting, i) => {
        const parts = [
          { name: orgName, value: accounting.toOrgGbp, colour, light: false },
          ...(!accounting.feeCovered ? [{
            name: "Estimated card processing", value: accounting.estimatedStripeFeeGbp, colour: "#F2EDE4", light: true,
          }] : []),
          { name: "Root ProjX platform fee", value: accounting.platformFeeGbp, colour: "#E0D8CC", light: true },
        ];
        return (
          <div key={i} className="space-y-1">
            <p className="text-xs font-semibold">{accounting.feeCovered ? "You cover the card fee" : "You don't cover the card fee"}</p>
            <div className="flex h-7 overflow-hidden rounded-md" role="img"
              aria-label={parts.map(p => `${p.name}: £${p.value.toFixed(2)}`).join("; ")}>
              {parts.map(p => (
                <span key={p.name} style={{ flexGrow: p.value, flexBasis: 0, backgroundColor: p.colour }}
                  className={`min-w-0 ${p.light ? "text-foreground" : "text-white"}`} />
              ))}
            </div>
            <p className="text-xs leading-relaxed text-[#3a2f28]">
              {parts.map(p => `${p.name}: £${p.value.toFixed(2)}`).join(" · ")}
            </p>
          </div>
        );
      })}
      <p className="text-sm leading-relaxed text-[#3a2f28]">
        Card companies charge a fee on every payment. When you give, you choose whether to cover it, and you see the exact amounts before you pay.
      </p>
    </div>
  );
}
