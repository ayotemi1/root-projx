import type {
  Campaign, CampaignBreakdownItem, CampaignPageDesign, CampaignPhase, TeamMember,
} from "@/lib/api";

/** Limits from the generated CampaignPageDesign contract. */
export const PD = {
  headline: 60,
  intro: 250,
  title: 30,
  programme: { min: 2, max: 4, title: 30, text: 160 },
  outcomes: { min: 3, max: 6, title: 40, text: 80 },
  team: { min: 1, max: 8, name: 40, role: 50 },
} as const;

/** Headings the shared page already shows when nothing is saved. Real copy, not placeholders. */
export const DEFAULT_HEADINGS = {
  need: "The story",
  programme: "What your money buys",
  outcomes: "What your support makes possible",
  team: "Who's running it",
  money: "Where your money goes",
  wall: "Recent supporters",
} as const;

export type CopyKey = "need" | "money" | "wall";
export type BoxKey = "programme" | "outcomes";

export interface BoxForm { id: string; title: string; text: string }
export interface PersonForm { id: string; name: string; role: string; photoUrl?: string | null }
export interface CopyForm { headline: string; intro: string }
export interface BoxSectionForm extends CopyForm { boxes: BoxForm[] }
export interface TeamForm extends CopyForm { people: PersonForm[] }

export interface LegacySource {
  description: string;
  breakdown: CampaignBreakdownItem[];
  phases: CampaignPhase[];
  pageContent: Record<string, unknown> | null | undefined;
  orgTeam: TeamMember[] | null | undefined;
}

const pcText = (pc: LegacySource["pageContent"], k: string) =>
  typeof pc?.[k] === "string" ? (pc[k] as string).trim() : "";

export const firstParagraph = (s: string) =>
  s.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)[0] ?? "";

export const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;

/** Editor form for a copy-only section: saved override, else what the page shows today. */
export function resolveCopy(pd: CampaignPageDesign, k: CopyKey, src: LegacySource): CopyForm {
  const saved = pd[k];
  if (saved) return { headline: saved.headline ?? "", intro: saved.intro ?? "" };
  if (k === "need") return { headline: pcText(src.pageContent, "storyHeading") || DEFAULT_HEADINGS.need, intro: firstParagraph(src.description) };
  if (k === "wall") return { headline: pcText(src.pageContent, "supportersHeading") || DEFAULT_HEADINGS.wall, intro: "" };
  return { headline: DEFAULT_HEADINGS.money, intro: "" };
}

export function resolveProgramme(pd: CampaignPageDesign, src: LegacySource): BoxSectionForm {
  const s = pd.programme;
  if (s) return { headline: s.headline ?? "", intro: s.intro ?? "", boxes: (s.boxes ?? []).map((b) => ({ ...b })) };
  return {
    headline: pcText(src.pageContent, "programmeHeading") || DEFAULT_HEADINGS.programme,
    intro: pcText(src.pageContent, "programmeIntro"),
    boxes: src.breakdown.filter((b) => b.label || b.detail).map((b, i) => ({ id: `legacy-breakdown-${i}`, title: b.label ?? "", text: b.detail ?? "" })),
  };
}

export function resolveOutcomes(pd: CampaignPageDesign, src: LegacySource): BoxSectionForm {
  const s = pd.outcomes;
  if (s) return { headline: s.headline ?? "", intro: s.intro ?? "", boxes: (s.boxes ?? []).map((b) => ({ ...b })) };
  return {
    headline: DEFAULT_HEADINGS.outcomes,
    intro: pcText(src.pageContent, "outcomesIntro"),
    boxes: src.phases.map((p, i) => ({ id: p.id || `legacy-phase-${i}`, title: p.title ?? "", text: p.description ?? "" })),
  };
}

export function resolveTeam(pd: CampaignPageDesign, src: LegacySource): TeamForm {
  const s = pd.team;
  if (s) return { headline: s.headline ?? "", intro: s.intro ?? "", people: (s.people ?? []).map((p) => ({ ...p })) };
  return {
    headline: DEFAULT_HEADINGS.team, intro: "",
    people: (src.orgTeam ?? []).filter((t) => t.name).map((t, i) => ({ id: `org-team-${i}`, name: t.name, role: t.role ?? "", photoUrl: t.photoUrl ?? null })),
  };
}

export function legacySourceOf(c: Pick<Campaign, "description" | "breakdown" | "phases" | "pageContent">, orgTeam?: TeamMember[] | null): LegacySource {
  return {
    description: c.description ?? "",
    breakdown: c.breakdown ?? [],
    phases: c.phases ?? [],
    pageContent: c.pageContent as LegacySource["pageContent"],
    orgTeam,
  };
}

/** Plain-words reason the saved design cannot be sent as-is; never trims anything. */
export function pageDesignProblem(pd: CampaignPageDesign | null | undefined): string | null {
  if (!pd) return null;
  const copy = (label: string, s?: { headline?: string; intro?: string }) => {
    if (!s) return null;
    if ((s.headline ?? "").length > PD.headline) return `${label} headline is ${(s.headline ?? "").length - PD.headline} characters too long.`;
    if ((s.intro ?? "").length > PD.intro) return `${label} intro is ${(s.intro ?? "").length - PD.intro} characters too long.`;
    return null;
  };
  for (const [k, label] of [["need", "The need"], ["money", "Where your money goes"], ["wall", "The wall"]] as const) {
    const p = copy(label, pd[k]); if (p) return p;
  }
  for (const k of ["programme", "outcomes"] as const) {
    const s = pd[k]; if (!s) continue;
    const L = PD[k]; const label = k === "programme" ? "The programme" : "Outcomes";
    const p = copy(label, s); if (p) return p;
    if (s.boxes.length < L.min) return `${label} needs at least ${L.min} boxes (${s.boxes.length} now).`;
    if (s.boxes.length > L.max) return `${label} can have up to ${L.max} boxes. Remove ${s.boxes.length - L.max}.`;
    const i = s.boxes.findIndex((b) => b.title.length > L.title || b.text.length > L.text);
    if (i >= 0) return `${label} box ${i + 1} is too long. Titles fit ${L.title} characters, text ${L.text}.`;
  }
  if (pd.team) {
    const p = copy("Who's running it", pd.team); if (p) return p;
    const n = pd.team.people.length;
    if (n < PD.team.min) return "Who's running it needs at least 1 person.";
    if (n > PD.team.max) return `Who's running it can list up to ${PD.team.max} people. Remove ${n - PD.team.max}.`;
    const i = pd.team.people.findIndex((p) => p.name.length > PD.team.name || p.role.length > PD.team.role);
    if (i >= 0) return `Person ${i + 1} is too long. Names fit ${PD.team.name} characters, roles ${PD.team.role}.`;
  }
  return null;
}

/** Narrative the story gate counts for structured campaigns (mirrors the server). */
export function narrativeLength(description: string, pd: CampaignPageDesign | null | undefined): number {
  const paras = description.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const desc = (pd?.need ? paras.slice(1) : paras).join("\n\n");
  let n = desc.length;
  n += (pd?.need?.intro ?? "").trim().length;
  n += (pd?.programme?.intro ?? "").trim().length;
  n += (pd?.programme?.boxes ?? []).reduce((a, b) => a + b.text.trim().length, 0);
  n += (pd?.outcomes?.intro ?? "").trim().length;
  n += (pd?.outcomes?.boxes ?? []).reduce((a, b) => a + b.text.trim().length, 0);
  return n;
}

export const isStructured = (pd: CampaignPageDesign | null | undefined) =>
  !!(pd && (pd.need || pd.programme || pd.outcomes || pd.team || pd.money || pd.wall));

/** Plain-words layout of n equal boxes on the six-column grid. */
export function layoutWords(n: number) {
  return n === 1 ? "1 box across" : n === 2 ? "2 side by side" : n === 3 ? "a row of 3" : n === 4 ? "2 rows of 2" : n === 5 ? "3 across, then 2 wider" : n === 6 ? "2 rows of 3" : `${n} boxes`;
}
export function layoutSpans(n: number) {
  return n === 1 ? [6] : n === 2 || n === 4 ? Array(n).fill(3) : n === 5 ? [2, 2, 2, 3, 3] : Array(n).fill(2);
}
