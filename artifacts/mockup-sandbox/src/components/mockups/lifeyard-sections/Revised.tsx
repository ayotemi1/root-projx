import "./_group.css";
const description = [
  "Talent is everywhere. Opportunities to nurture it aren’t. In Kingston’s developing communities, such as Parade Gardens in central Kingston, many children have limited access to recreational and cultural activities that give their energy somewhere to go and their creativity room to grow.",
  "Drum Life opens that space through “edutainment”: learning that feels like play. Led by master drummer Moustafa Reds, Life Yard’s programmes and workshops have been bringing young people together to learn Jamaican and West African rhythms, explore their cultural roots and build confidence through drumming.",
  "Alongside the workshops, we’re raising funds for an on-site social worker to support the children’s wellbeing, respond to concerns and give them someone to turn to when they need support.",
  "Working towards the JCDC competition gives the children something to practise for, a reason to keep going and an opportunity to represent their community on a national stage.",
  "Help keep the rhythm going. Your donation supports workshops, instruments, on-site wellbeing support and the children’s journey from their community to the stage.",
];
const breakdown = [
  { label: "$7500", detail: "50 drums for hands-on learning, practice and performance, including djembe, funde, kette, bass and congo drums." },
  { label: "$650", detail: "Three months of drumming tuition with master drummer Moustafa Reds." },
  { label: "$2000", detail: "Workshop spaces where children can come together to learn and rehearse." },
  { label: "$2,850 ", detail: "Transport and refreshments to help children attend and participate in the workshops." },
  { label: "$2000", detail: "An on-site social worker to support the children’s wellbeing, respond to concerns and provide a trusted person to turn to throughout the workshops." },
  { label: "$1000", detail: "Contingency fund to cover unforeseen programme costs, such as additional transport, replacement materials or changes to workshop arrangements." },
];
const DRUM_LIFE_COPY = {
  storyHeading: "The story",
  budgetHeading: "What your money buys",
  budgetIntro: "Support hands-on drumming through instruments, tuition, workshop spaces and wellbeing support for children.",
  drumIntro: "The drum budget covers 50 drums at US$150 each (US$7,500 total), including the reclaimed-wood centre drum made by Humanity Ova Vanity.",
  budgetCurrencyNote: "All listed amounts are in US dollars (US$).",
} as const;

/** Short, factual summaries for the six current Drum Life budget descriptions. */
function drumBudgetPurpose(detail: string): string | null {
  const text = detail.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  if (text.includes("50 drums") && text.includes("hands on learning") && text.includes("practice") && text.includes("performance")) {
    return "50 drums";
  }
  if (text.includes("three months") && text.includes("drumming tuition") && text.includes("moustafa reds")) {
    return "Drumming tuition";
  }
  if (text.includes("workshop spaces") && text.includes("learn") && text.includes("rehearse")) {
    return "Workshop spaces";
  }
  if (text.includes("transport and refreshments") && text.includes("attend") && text.includes("workshops")) {
    return "Transport & refreshments";
  }
  if (text.includes("on site social worker") && text.includes("wellbeing") && text.includes("trusted person")) {
    return "On-site wellbeing support";
  }
  if (text.includes("contingency fund") && text.includes("unforeseen programme costs")) {
    return "Contingency";
  }
  return null;
}

type LifeyardLayout = "responsive" | "phone" | "desktop";
type Row = { label?: string; detail?: string };

// Static strings so Tailwind emits every variant; forced layouts ignore the viewport.
const V = {
  title: { responsive: "sm:text-[3.25rem]", phone: "", desktop: "text-[3.25rem]" },
  row: { responsive: "sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-6 sm:p-5", phone: "", desktop: "grid-cols-[8.5rem_minmax(0,1fr)] gap-6 p-5" },
  amount: { responsive: "sm:block", phone: "", desktop: "block" },
  bar: { responsive: "sm:mt-3 sm:block", phone: "", desktop: "mt-3 block" },
} as const;

/** Formats only plain dollar figures like "$7500" or "$2,850 " for USD campaigns; anything else is shown as saved. */
function formatCostLabel(label: string, currency?: string): string {
  const v = label.trim();
  if ((currency ?? "").toLowerCase() !== "usd") return v;
  const m = v.match(/^\$\s?(\d{1,3}(?:,\d{3})+|\d+)$/);
  if (!m) return v;
  return `US$${Number(m[1].replace(/,/g, "")).toLocaleString("en-US")}`;
}

/** Lifeyard (Drum Life) only: centred story and a readable cost list. */
function LifeyardStory({ heading, lead, rest, red, layout = "responsive" }: { heading: string; lead: string; rest: string[]; red: string; layout?: LifeyardLayout }) {
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

function LifeyardBreakdown({ heading, summary, intro, afterword, rows, red, gold, currency, layout = "responsive" }: {
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

export function Revised() {
  const red = "#B50000";
  const gold = "#F5B800";
  const [lead, ...rest] = description;
  const budgetOnly = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("section") === "budget";
  return (
    <main className="lifeyard-extraction min-h-screen">
      {!budgetOnly && <section className="py-14 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-5 md:px-10">
          <LifeyardStory heading={DRUM_LIFE_COPY.storyHeading} lead={lead} rest={rest} red={red} />
        </div>
      </section>}
      <section id="budget" className="pb-14 md:pb-20 bg-white">
        <div className="max-w-6xl mx-auto px-5 md:px-10 border-t-2 border-[#1c1410] pt-10">
          <LifeyardBreakdown heading={DRUM_LIFE_COPY.budgetHeading} summary="" intro={[]} afterword={[]} rows={breakdown} red={red} gold={gold} currency="usd" />
        </div>
      </section>
    </main>
  );
}
