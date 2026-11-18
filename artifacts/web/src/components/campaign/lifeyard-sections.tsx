import { DRUM_LIFE_COPY, drumBudgetPurpose } from "@/lib/drum-life-copy";

export type LifeyardLayout = "responsive" | "phone" | "desktop";
type Row = { label?: string; detail?: string };

// Static strings so Tailwind emits every variant; forced layouts ignore the viewport.
const V = {
  title: { responsive: "sm:text-[3.25rem]", phone: "", desktop: "text-[3.25rem]" },
  row: { responsive: "sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-6 sm:p-5", phone: "", desktop: "grid-cols-[8.5rem_minmax(0,1fr)] gap-6 p-5" },
  amount: { responsive: "sm:block", phone: "", desktop: "block" },
  bar: { responsive: "sm:mt-3 sm:block", phone: "", desktop: "mt-3 block" },
} as const;

/** Formats only plain dollar figures like "$7500" or "$2,850 " for USD campaigns; anything else is shown as saved. */
export function formatCostLabel(label: string, currency?: string): string {
  const v = label.trim();
  if ((currency ?? "").toLowerCase() !== "usd") return v;
  const m = v.match(/^\$\s?(\d{1,3}(?:,\d{3})+|\d+)$/);
  if (!m) return v;
  return `US$${Number(m[1].replace(/,/g, "")).toLocaleString("en-US")}`;
}

/** Lifeyard (Drum Life) only: centred story and a readable cost list. */
export function LifeyardStory({ heading, lead, rest, red, layout = "responsive" }: { heading: string; lead: string; rest: string[]; red: string; layout?: LifeyardLayout }) {
  return (
    <div className="mx-auto max-w-[44rem] text-center" data-testid="block-lifeyard-story">
      <h2 className={`text-[2.25rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-[#1c1410] break-words ${V.title[layout]}`}>{heading}</h2>
      <span className="mx-auto mt-5 block h-1 w-14 rounded-full" style={{ backgroundColor: red }} aria-hidden="true" />
      <div data-testid="text-campaign-description" className="mt-7 space-y-5 text-[1.05rem] leading-[1.75] text-[#3a2f28] break-words">
        <p className="text-[1.2rem] leading-[1.6] font-semibold text-[#1c1410] whitespace-pre-wrap">{lead}</p>
        {rest.map((p, i) => <p key={i} className="whitespace-pre-wrap">{p}</p>)}
      </div>
    </div>
  );
}

export function LifeyardBreakdown({ heading, summary, intro, afterword, rows, red, gold, currency, layout = "responsive" }: {
  heading: string; summary: string; intro: string[]; afterword: string[]; rows: Row[]; red: string; gold: string; currency?: string; layout?: LifeyardLayout;
}) {
  const isUsd = (currency ?? "").toLowerCase() === "usd";
  return (
    <div className="mx-auto max-w-[48rem]" data-testid="list-campaign-breakdown">
      <div className="text-center">
        <h2 className={`text-[2.25rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-[#1c1410] break-words ${V.title[layout]}`}>{heading}</h2>
        {summary && <p className="mt-4 inline-block rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white" style={{ backgroundColor: red }} data-testid="text-programme-summary">{summary}</p>}
        {intro.length > 0 ? (
          <div className="mt-5 space-y-3 text-[1.02rem] leading-relaxed text-[#3a2f28]" data-testid="text-programme-intro">
            {intro.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        ) : DRUM_LIFE_COPY.budgetIntro ? (
          <p className="mt-5 text-[1.02rem] leading-relaxed text-[#3a2f28]" data-testid="text-budget-intro">{DRUM_LIFE_COPY.budgetIntro}</p>
        ) : null}
      </div>
      <ul className="mt-9 space-y-3" aria-label="Programme costs">
        {rows.map((b, i) => {
          const label = b.label?.trim() ? formatCostLabel(b.label, currency) : "";
          const detail = b.detail?.trim() ?? "";
          const purpose = detail ? drumBudgetPurpose(detail) : null;
          return (
            <li key={i} data-testid={`row-breakdown-${i}`}
              className={`grid grid-cols-1 gap-2 rounded-2xl border border-[#E0D8CC] bg-[#FBF8F3] p-4 ${label && detail ? V.row[layout] : ""} motion-safe:transition-[border-color,background-color] motion-safe:duration-200 hover:border-[#cbbfae] hover:bg-[#F7F1E7] focus-within:border-[#cbbfae]`}>
              {label && (
                <p className={`flex items-center gap-2 ${V.amount[layout]}`}>
                  <span className="sr-only">Cost: </span>
                  <span className="text-[1.5rem] leading-none font-extrabold tabular-nums tracking-[-0.02em] break-words" style={{ color: red }} data-testid={`text-breakdown-amount-${i}`}>{label}</span>
                  <span className={`h-1 w-8 rounded-full ${V.bar[layout]}`} style={{ backgroundColor: gold }} aria-hidden="true" />
                </p>
              )}
              {detail && (
                <div className="min-w-0">
                  {purpose && <p className="mb-1 font-extrabold leading-snug text-[#1c1410]">{purpose}</p>}
                  <p className="text-[0.98rem] leading-relaxed text-[#2e241e] break-words"><span className="sr-only">Pays for: </span>{detail}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {isUsd && DRUM_LIFE_COPY.budgetCurrencyNote && <p className="mt-4 text-center text-[13px] text-[#6b5f55]" data-testid="text-budget-currency">{DRUM_LIFE_COPY.budgetCurrencyNote}</p>}
      {afterword.length > 0 && (
        <div className="mt-7 space-y-3 text-center text-[1.02rem] leading-relaxed text-[#3a2f28]" data-testid="text-programme-afterword">
          {afterword.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
    </div>
  );
}
