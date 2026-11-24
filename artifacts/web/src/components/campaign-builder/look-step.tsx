import type { CampaignColourScheme, CampaignEditableSection } from "@/lib/api";
import { StepLook as LookExtras } from "./steps";
import type { StoryStepProps } from "./story-step";
import { CampaignLivePreview } from "./live-preview";
import { DEFAULT_SCHEMES, SECTION_ORDER, resolveSectionOrder } from "@/components/campaign/section-design";
import { legacySourceOf, resolveCopy, resolveOutcomes, resolveProgramme, resolveTeam } from "./story-design";

const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;
const NAMES: Record<CampaignEditableSection, string> = {
  need: "The need", programme: "The programme", outcomes: "Outcomes", team: "Who's running it", money: "Where your money goes", wall: "The wall",
};
const SCHEMES: CampaignColourScheme[] = ["cream", "white", "red", "ink", "yellow"];
const SCHEME_LABEL: Record<CampaignColourScheme, string> = { cream: "Cream", white: "White", red: "Red", ink: "Black", yellow: "Yellow" };

function Fixed({ n, title, note, testId }: { n: string; title: string; note: string; testId: string }) {
  return (
    <div className="border-[1.5px] border-dashed border-[#17100F] bg-[#EDE4D6] px-4 py-3 mb-2" data-testid={testId}>
      <p className="m-0 font-bold text-[15px]">{n} {title}</p>
      <p className="m-0 mt-1 text-[12px] text-[#5A4F4B]">{note}</p>
    </div>
  );
}

export function StepLookSections(props: StoryStepProps) {
  const { d, update, campaign, org } = props;
  const pd = d.pageDesign ?? {};
  const order = resolveSectionOrder(pd.order);
  const page = { red: d.colours.primaryColor || "#CA0813", yellow: d.colours.accentColor || "#F3BF2C" };
  const fill: Record<CampaignColourScheme, { bg: string; fg: string }> = {
    cream: { bg: "#F4EFE6", fg: "#17100F" }, white: { bg: "#FFFDF9", fg: "#17100F" },
    red: { bg: page.red, fg: "#FFFDF9" }, ink: { bg: "#17100F", fg: "#F4EFE6" }, yellow: { bg: page.yellow, fg: "#17100F" },
  };

  // Counts are read, never materialised: Look only writes order and schemes.
  const src = legacySourceOf({ description: d.description, breakdown: d.breakdown, phases: campaign?.phases ?? [], pageContent: campaign?.pageContent }, org?.team);
  const countNote = (k: CampaignEditableSection) => {
    if (k === "programme") { const n = pd.programme?.boxes.length ?? d.breakdown.filter(b => b.label || b.detail).length; return `${n} ${n === 1 ? "box" : "boxes"} (set in Story)`; }
    if (k === "outcomes") { const n = pd.outcomes?.boxes.length ?? (campaign?.phases ?? []).length; return `${n} ${n === 1 ? "box" : "boxes"} (set in Story)`; }
    if (k === "team") { const n = pd.team?.people.length ?? (org?.team ?? []).filter(p => p.name).length; return `${n} ${n === 1 ? "person" : "people"} (set in Story)`; }
    return null;
  };
  const headingOf = (k: CampaignEditableSection) => {
    if (k === "programme") return resolveProgramme(pd, src).headline;
    if (k === "outcomes") return resolveOutcomes(pd, src).headline;
    if (k === "team") return resolveTeam(pd, src).headline;
    return resolveCopy(pd, k, src).headline;
  };

  const move = (k: CampaignEditableSection, dir: -1 | 1) => update((prev) => {
    const cur = [...resolveSectionOrder(prev.pageDesign?.order)];
    const i = cur.indexOf(k); const j = i + dir;
    if (j < 0 || j >= cur.length) return {};
    [cur[i], cur[j]] = [cur[j], cur[i]];
    return { pageDesign: { ...(prev.pageDesign ?? {}), order: cur } };
  });
  const setScheme = (k: CampaignEditableSection, v: CampaignColourScheme) => update((prev) => ({
    pageDesign: { ...(prev.pageDesign ?? {}), schemes: { ...(prev.pageDesign?.schemes ?? {}), [k]: v } },
  }));

  return (
    <div className="@container min-w-0" data-testid="layout-look-step">
      <div className="grid gap-8 @[900px]:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] items-start">
        <div className="min-w-0" style={{ fontFamily: "'Familjen Grotesk', system-ui, sans-serif" }}>
          <p className="mt-0 mb-4 max-w-[640px] text-[#5A4F4B] text-[15px]">Move sections up or down and pick a colour for each. The top of the page and the give box stay where they are.</p>

          <Fixed n="01" title="Top of the page" note="Title, hero image, hands wall, donation panel and funding bar. Always uses your campaign colours." testId="card-look-top" />
          <ol className="list-none m-0 p-0" aria-label="Page sections in order">
            {order.map((k, i) => {
              const scheme = pd.schemes?.[k] ?? DEFAULT_SCHEMES[k];
              const note = countNote(k);
              return (
                <li key={k} className="border-[1.5px] border-[#17100F] bg-[#FFFDF9] px-4 py-3 mb-2" data-testid={`card-look-${k}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="m-0 font-bold text-[15px]">{String(i + 2).padStart(2, "0")} {NAMES[k]}</p>
                      <p className="m-0 text-[13px] text-[#5A4F4B] truncate">{headingOf(k) || "No headline"}</p>
                      {note && <p className="m-0 mt-0.5 text-[11px] uppercase tracking-[0.1em] text-[#5A4F4B]" style={MONO} data-testid={`text-look-count-${k}`}>{note}</p>}
                    </div>
                    <span className="inline-flex border-[1.5px] border-[#17100F] shrink-0">
                      <button type="button" onClick={() => move(k, -1)} disabled={i === 0} aria-label={`Move ${NAMES[k]} up`}
                        title={i === 0 ? "Already first after the top of the page" : undefined}
                        className="w-9 h-9 font-bold text-[16px] bg-[#FFFDF9] disabled:text-[#B5ABA4] disabled:cursor-default border-r-[1.5px] border-[#17100F]" data-testid={`button-look-up-${k}`}>↑</button>
                      <button type="button" onClick={() => move(k, 1)} disabled={i === order.length - 1} aria-label={`Move ${NAMES[k]} down`}
                        title={i === order.length - 1 ? "Already last before the give box" : undefined}
                        className="w-9 h-9 font-bold text-[16px] bg-[#FFFDF9] disabled:text-[#B5ABA4] disabled:cursor-default" data-testid={`button-look-down-${k}`}>↓</button>
                    </span>
                  </div>
                  <p className="mt-3 mb-2 text-[11px] uppercase tracking-[0.1em] text-[#5A4F4B]" style={MONO}>Colour scheme</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${NAMES[k]} colour`}>
                    {SCHEMES.map((v) => {
                      const on = scheme === v;
                      return (
                        <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setScheme(k, v)}
                           className="w-14 bg-transparent border-0 p-0 text-center"
                          data-testid={`button-look-scheme-${k}-${v}`}>
                           <span className={`h-10 flex items-center justify-center gap-1 border-[1.5px] border-[#17100F] text-[17px] font-black ${on ? "outline outline-[3px] outline-[#17100F] outline-offset-2" : ""}`}
                             style={{ background: fill[v].bg, color: fill[v].fg, fontFamily: "'Archivo', sans-serif" }} aria-hidden="true">
                             Aa<i className="w-2 h-2 rounded-full" style={{ background: v === "red" || v === "ink" ? page.yellow : page.red }} />
                           </span>
                           <span className={`block mt-1 text-[11px] ${on ? "font-bold text-[#17100F]" : "text-[#5A4F4B]"}`}>{SCHEME_LABEL[v]}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
          <Fixed n={String(SECTION_ORDER.length + 2).padStart(2, "0")} title="Give" note="The closing section. Always black, always last." testId="card-look-give" />

          <details className="border-[1.5px] border-[#17100F] bg-[#FFFDF9] px-4 py-3.5 mt-4" data-testid="details-look-more">
            <summary className="cursor-pointer text-[15px] font-bold">Hero image, videos, unit and page colours</summary>
            <p className="text-[13px] text-[#5A4F4B] mt-1 mb-4">The hero image is needed to publish. Page colours set the red and yellow used above.</p>
            <LookExtras {...props} />
          </details>
        </div>
        {campaign && <CampaignLivePreview d={d} campaign={campaign} org={org} className="hidden lg:block" />}
      </div>
    </div>
  );
}
