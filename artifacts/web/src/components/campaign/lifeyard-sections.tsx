import { DRUM_LIFE_COPY, drumBudgetPurpose } from "@/lib/drum-life-copy";
import { useFitSplit } from "./use-fit-split";

export type LifeyardLayout = "responsive" | "phone" | "desktop";
type Row = { label?: string; detail?: string };

/** Formats only plain dollar figures like "$7500" or "$2,850 " for USD campaigns; anything else is shown as saved. */
export function formatCostLabel(label: string, currency?: string): string {
  const v = label.trim();
  if ((currency ?? "").toLowerCase() !== "usd") return v;
  const m = v.match(/^\$\s?(\d{1,3}(?:,\d{3})+|\d+)$/);
  if (!m) return v;
  return `US$${Number(m[1].replace(/,/g, "")).toLocaleString("en-US")}`;
}

/** Lifeyard uses the same fitted headline-and-copy row as other campaigns. */
export function LifeyardStory({ heading, lead, rest }: { heading: string; lead: string; rest: string[]; red?: string; layout?: LifeyardLayout }) {
  const fitRef = useFitSplit<HTMLDivElement>([heading, lead, ...rest].join("\u0000"));
  return (
    <div ref={fitRef} data-testid="block-lifeyard-story" className="rc-fit-split has-intro">
      <h2 className="rc-display rc-h2">{heading}</h2>
      <div className="rc-fit-intro">
        <div data-testid="text-campaign-description" className="rc-story-body rc-story-readable">
          <p className="rc-lead">{lead}</p>
          {rest.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>
    </div>
  );
}

/** Dark bento of real budget rows. Amounts are shown exactly as saved (USD figures normalised to US$). */
export function LifeyardBreakdown({ heading, summary, intro, afterword, rows, currency }: {
  heading: string; summary: string; intro: string[]; afterword: string[]; rows: Row[]; red?: string; gold?: string; currency?: string; layout?: LifeyardLayout;
}) {
  const isUsd = (currency ?? "").toLowerCase() === "usd";
  const body = intro.length ? intro : DRUM_LIFE_COPY.budgetIntro ? [DRUM_LIFE_COPY.budgetIntro] : [];
  const fitRef = useFitSplit<HTMLDivElement>([heading, summary, ...body].join("\u0000"));
  return (
    <div data-testid="list-campaign-breakdown">
      <div ref={fitRef} className={`rc-fit-split ${body.length || summary ? "has-intro" : ""}`}>
        <h2 className="rc-display rc-h2">{heading}</h2>
        {(body.length > 0 || summary) && <div className="rc-fit-intro">
          {summary && <p className="rc-pill rc-mono" data-testid="text-programme-summary">{summary}</p>}
          {body.length > 0 && <div className="rc-prose" data-testid={intro.length ? "text-programme-intro" : "text-budget-intro"}>
            {body.map((p, i) => <p key={i}>{p}</p>)}
          </div>}
        </div>}
      </div>
      <ul className="rc-bento-grid rc-boxes list-none p-0 mt-12 mb-0" data-n={rows.length} aria-label="Programme costs">
        {rows.map((b, i) => {
          const label = b.label?.trim() ? formatCostLabel(b.label, currency) : "";
          const detail = b.detail?.trim() ?? "";
          const purpose = detail ? drumBudgetPurpose(detail) : null;
          return (
            <li key={i} className="rc-trade" data-testid={`row-breakdown-${i}`}>
              {label && <span className="rc-display rc-trade-amount" data-testid={`text-breakdown-amount-${i}`}><span className="rc-sr">Cost: </span>{label}</span>}
              {purpose && <h3>{purpose}</h3>}
              {detail && <p><span className="rc-sr">Pays for: </span>{detail}</p>}
              <span className="rc-mono rc-trade-code">B—{String(i + 1).padStart(2, "0")}</span>
            </li>
          );
        })}
      </ul>
      {((isUsd && DRUM_LIFE_COPY.budgetCurrencyNote) || afterword.length > 0) && (
        <div className="rc-bento" style={{ borderTop: 0 }}>
          <div className="rc-loc-close">
            {afterword.length > 0 && (
              <div className="rc-prose" data-testid="text-programme-afterword">
                {afterword.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
            {isUsd && DRUM_LIFE_COPY.budgetCurrencyNote && <p className="m-0 text-[15px]" data-testid="text-budget-currency">{DRUM_LIFE_COPY.budgetCurrencyNote}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
