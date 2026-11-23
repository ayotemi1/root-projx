import { useId, type ReactNode } from "react";
import type { Campaign, CampaignPageDesign, Org } from "@/lib/api";
import { LegacyStoryFields, type StepProps } from "./steps";
import { CampaignLivePreview } from "./live-preview";
import { STORY_MIN, TITLE_MAX, type CampaignDraft } from "./model";
import {
  PD, isStructured, layoutSpans, layoutWords, legacySourceOf, narrativeLength, newId,
  resolveCopy, resolveOutcomes, resolveProgramme, resolveTeam,
  type BoxForm, type BoxKey, type BoxSectionForm, type CopyForm, type CopyKey, type PersonForm, type TeamForm,
} from "./story-design";

const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

export interface StoryStepProps extends StepProps {
  campaign?: Campaign;
  org?: Org | null;
}

/** n / max. Amber from 85%, red at the limit; overlong legacy text is kept and flagged, never cut. */
export function LimitCounter({ n, max, id }: { n: number; max: number; id?: string }) {
  const tone = n > max ? "text-[#CA0813] font-bold" : n >= max ? "text-[#CA0813] font-bold" : n >= max * 0.85 ? "text-[#8A5A00]" : "text-[#5A4F4B]";
  return (
    <span id={id} className={`text-[11px] font-normal tabular-nums ${tone}`} style={MONO} aria-live="polite">
      {n} / {max}{n > max ? ` · ${n - max} over` : ""}
    </span>
  );
}

function Fld({ label, value, max, placeholder, area, onChange, testId }: {
  label: string; value: string; max: number; placeholder: string; area?: boolean; onChange: (v: string) => void; testId: string;
}) {
  const id = useId();
  const over = value.length > max;
  const cls = "w-full mt-1.5 border-[1.5px] border-[#17100F] px-[11px] py-[9px] text-[15px] bg-[#FFFDF9] text-[#17100F] focus:outline focus:outline-[3px] focus:outline-[#F3BF2C] focus:outline-offset-0 resize-y";
  return (
    <label className="block mt-3" htmlFor={id}>
      <span className="flex justify-between items-baseline gap-2 text-[13px] font-bold">
        {label}<LimitCounter n={value.length} max={max} id={`${id}-count`} />
      </span>
      {area ? (
        <textarea id={id} rows={3} value={value} placeholder={placeholder} aria-describedby={`${id}-count`} aria-invalid={over}
          onChange={(e) => onChange(e.target.value)} className={cls} data-testid={testId} />
      ) : (
        <input id={id} value={value} placeholder={placeholder} aria-describedby={`${id}-count`} aria-invalid={over}
          onChange={(e) => onChange(e.target.value)} className={cls} data-testid={testId} />
      )}
      {over && <span className="block mt-1 text-[12px] font-semibold text-[#CA0813]" role="alert">Shorten by {value.length - max} characters. Nothing has been cut.</span>}
    </label>
  );
}

function Sec({ title, sub, right, fixed, children, testId }: { title: string; sub?: ReactNode; right?: ReactNode; fixed?: boolean; children?: ReactNode; testId: string }) {
  return (
    <section className={`border-[1.5px] border-[#17100F] px-4 py-3.5 mb-2.5 ${fixed ? "bg-[#EDE4D6] border-dashed" : "bg-[#FFFDF9]"}`} data-testid={testId}>
      <div className="flex justify-between items-center gap-2.5">
        <h4 className="m-0 text-[15px] font-bold" style={{ fontFamily: "'Familjen Grotesk', system-ui, sans-serif", fontStretch: "normal", fontVariationSettings: "normal", letterSpacing: 0 }}>{title}</h4>
        {right && <span className="text-[12px] uppercase tracking-[0.1em] text-[#5A4F4B]" style={MONO}>{right}</span>}
      </div>
      {sub && <p className="text-[13px] text-[#5A4F4B] mt-0.5 mb-0">{sub}</p>}
      {children}
    </section>
  );
}

function LayoutMini({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-2.5 mt-2.5 text-[13px] text-[#5A4F4B]" data-testid="text-box-layout">
      <span className="grid gap-[2px] bg-[#17100F] border-[1.5px] border-[#17100F] shrink-0" style={{ gridTemplateColumns: "repeat(6, 8px)" }} aria-hidden="true">
        {layoutSpans(n).map((s, i) => <i key={i} className="block h-2 bg-[#F3BF2C]" style={{ gridColumn: `span ${s}` }} />)}
      </span>
      <span>Layout: {layoutWords(n)}. Every box is the same size.</span>
    </div>
  );
}

function ItemHead({ label, onRemove, min, count, testId }: { label: string; onRemove: () => void; min: number; count: number; testId: string }) {
  const blocked = count <= min;
  return (
    <div className="flex justify-between items-center">
      <span className="text-[12px] uppercase tracking-[0.1em] font-bold" style={MONO}>{label}</span>
      <button type="button" onClick={onRemove} disabled={blocked} title={blocked ? `This section needs at least ${min}` : undefined}
        className="border-0 bg-transparent text-[13px] font-bold underline cursor-pointer text-[#17100F] disabled:text-[#B5ABA4] disabled:no-underline disabled:cursor-default"
        data-testid={testId}>Remove</button>
    </div>
  );
}

function AddButton({ unit, count, max, onAdd, testId }: { unit: string; count: number; max: number; onAdd: () => void; testId: string }) {
  const full = count >= max;
  return (
    <button type="button" onClick={onAdd} disabled={full}
      className="mt-3.5 w-full inline-flex items-center justify-center gap-2 border-[1.5px] border-dashed border-[#17100F] bg-[#FFFDF9] px-4 py-2.5 text-[15px] font-bold text-[#17100F] disabled:opacity-45 disabled:cursor-default"
      data-testid={testId}>
      + Add {unit}{full ? ` · ${max} is the most for this section` : ` · up to ${max}`}
    </button>
  );
}

export function StepStory(props: StoryStepProps) {
  const { d, update, campaign, org } = props;
  const pd = d.pageDesign ?? {};
  const phases = campaign?.phases ?? [];
  const pageContent = campaign?.pageContent;
  const srcOf = (x: CampaignDraft) => legacySourceOf({ description: x.description, breakdown: x.breakdown, phases, pageContent }, org?.team);
  const src = srcOf(d);

  /** Materialise a section only when the organiser edits it. */
  const setPd = <K extends keyof CampaignPageDesign>(k: K, fn: (prev: CampaignDraft) => CampaignPageDesign[K]) =>
    update((prev) => ({ pageDesign: { ...(prev.pageDesign ?? {}), [k]: fn(prev) } }));

  const editCopy = (k: CopyKey, patch: Partial<CopyForm>) =>
    setPd(k, (prev) => ({ ...resolveCopy(prev.pageDesign ?? {}, k, srcOf(prev)), ...patch }));
  const resolveBoxes = (k: BoxKey, x: CampaignDraft) =>
    k === "programme" ? resolveProgramme(x.pageDesign ?? {}, srcOf(x)) : resolveOutcomes(x.pageDesign ?? {}, srcOf(x));
  const editBoxes = (k: BoxKey, fn: (s: BoxSectionForm) => BoxSectionForm) =>
    setPd(k, (prev) => fn(resolveBoxes(k, prev)));
  const editTeam = (fn: (s: TeamForm) => TeamForm) =>
    setPd("team", (prev) => fn(resolveTeam(prev.pageDesign ?? {}, srcOf(prev))));

  const storyLen = isStructured(pd) ? narrativeLength(d.description, pd) : d.description.trim().length;

  const copySec = (k: CopyKey, n: string, title: string, sub: string) => {
    const f = resolveCopy(pd, k, src);
    return (
      <Sec title={`${n} ${title}`} sub={sub} right={pd[k] ? "Edited" : undefined} testId={`section-story-${k}`}>
        <Fld label="Headline" value={f.headline} max={PD.headline} placeholder="Section headline" onChange={(v) => editCopy(k, { headline: v })} testId={`input-${k}-headline`} />
        <Fld label="Intro" value={f.intro} max={PD.intro} placeholder="A short intro" area onChange={(v) => editCopy(k, { intro: v })} testId={`input-${k}-intro`} />
      </Sec>
    );
  };

  const boxSec = (k: BoxKey, n: string, title: string) => {
    const L = PD[k];
    const f = resolveBoxes(k, d);
    const count = f.boxes.length;
    const ph = k === "programme" ? ["Trade or activity", "What people learn and why it matters"] : ["What changes", "One line on what it means"];
    const setBox = (id: string, patch: Partial<BoxForm>) => editBoxes(k, (s) => ({ ...s, boxes: s.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
    return (
      <Sec title={`${n} ${title}`} right={`${count} ${count === 1 ? "box" : "boxes"}`} testId={`section-story-${k}`}>
        <Fld label="Headline" value={f.headline} max={PD.headline} placeholder="Section headline" onChange={(v) => editBoxes(k, (s) => ({ ...s, headline: v }))} testId={`input-${k}-headline`} />
        <Fld label="Intro" value={f.intro} max={PD.intro} placeholder="A short intro" area onChange={(v) => editBoxes(k, (s) => ({ ...s, intro: v }))} testId={`input-${k}-intro`} />
        <LayoutMini n={count} />
        {count < L.min && <p className="mt-2 mb-0 text-[12px] font-semibold text-[#8A5A00]" role="status">This section needs at least {L.min} boxes. Add {L.min - count} more.</p>}
        {count > L.max && <p className="mt-2 mb-0 text-[12px] font-semibold text-[#CA0813]" role="alert">Up to {L.max} boxes fit here. Remove {count - L.max}; nothing has been removed for you.</p>}
        {f.boxes.map((b, i) => (
          <div key={b.id} className="border-t-[1.5px] border-[#17100F] mt-3.5 pt-2.5" data-testid={`row-${k}-box-${i}`}>
            <ItemHead label={`Box ${i + 1}`} min={L.min} count={count} testId={`button-remove-${k}-box-${i}`}
              onRemove={() => editBoxes(k, (s) => (s.boxes.length > L.min ? { ...s, boxes: s.boxes.filter((x) => x.id !== b.id) } : s))} />
            <Fld label="Title" value={b.title} max={L.title} placeholder={ph[0]} onChange={(v) => setBox(b.id, { title: v })} testId={`input-${k}-box-title-${i}`} />
            <Fld label="Text" value={b.text} max={L.text} placeholder={ph[1]} area onChange={(v) => setBox(b.id, { text: v })} testId={`input-${k}-box-text-${i}`} />
          </div>
        ))}
        <AddButton unit="box" count={count} max={L.max} testId={`button-add-${k}-box`}
          onAdd={() => editBoxes(k, (s) => (s.boxes.length < L.max ? { ...s, boxes: [...s.boxes, { id: newId(k), title: "", text: "" }] } : s))} />
      </Sec>
    );
  };

  const team = resolveTeam(pd, src);
  const teamCount = team.people.length;
  const setPerson = (id: string, patch: Partial<PersonForm>) => editTeam((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  return (
    <div className="@container min-w-0" data-testid="layout-story-step">
    <div className="grid gap-8 @[900px]:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] items-start">
      <div className="min-w-0" style={{ fontFamily: "'Familjen Grotesk', system-ui, sans-serif" }}>
        <p className="mt-0 mb-4 max-w-[640px] text-[#5A4F4B] text-[15px]">Write the words for each section. Add or remove boxes and they arrange themselves so the section always looks finished. Colours and order are in step 4, Look.</p>

        <Sec title="01 Top of the page" sub="The title sizes itself to fill the space beside your photo, however long it is." testId="section-story-top">
          <Fld label="Campaign title" value={d.name} max={TITLE_MAX} placeholder="Campaign title" onChange={(v) => update({ name: v })} testId="input-story-campaign-title" />
        </Sec>

        {copySec("need", "02", "The need", "Opens the story. The intro is the first thing people read.")}
        {boxSec("programme", "03", "The programme")}
        {boxSec("outcomes", "04", "Outcomes")}

        <Sec title="05 Who's running it" right={`${teamCount} ${teamCount === 1 ? "person" : "people"}`}
          sub="People shown on this campaign only. Your organisation's team and member access are not changed." testId="section-story-team">
          <Fld label="Headline" value={team.headline} max={PD.headline} placeholder="Section headline" onChange={(v) => editTeam((s) => ({ ...s, headline: v }))} testId="input-team-headline" />
          <Fld label="Intro" value={team.intro} max={PD.intro} placeholder="A short intro" area onChange={(v) => editTeam((s) => ({ ...s, intro: v }))} testId="input-team-intro" />
          {teamCount > PD.team.max && <p className="mt-2 mb-0 text-[12px] font-semibold text-[#CA0813]" role="alert">Up to {PD.team.max} people fit here. Remove {teamCount - PD.team.max}; nothing has been removed for you.</p>}
          {team.people.map((p, i) => (
            <div key={p.id} className="border-t-[1.5px] border-[#17100F] mt-3.5 pt-2.5" data-testid={`row-team-person-${i}`}>
              <ItemHead label={`Person ${i + 1}`} min={PD.team.min} count={teamCount} testId={`button-remove-team-person-${i}`}
                onRemove={() => editTeam((s) => (s.people.length > PD.team.min ? { ...s, people: s.people.filter((x) => x.id !== p.id) } : s))} />
              <Fld label="Name" value={p.name} max={PD.team.name} placeholder="Name" onChange={(v) => setPerson(p.id, { name: v })} testId={`input-team-name-${i}`} />
              <Fld label="Role" value={p.role} max={PD.team.role} placeholder="Role" onChange={(v) => setPerson(p.id, { role: v })} testId={`input-team-role-${i}`} />
              <div className="mt-3 max-w-[140px]">
              </div>
            </div>
          ))}
          <AddButton unit="person" count={teamCount} max={PD.team.max} testId="button-add-team-person"
            onAdd={() => editTeam((s) => (s.people.length < PD.team.max ? { ...s, people: [...s.people, { id: newId("person"), name: "", role: "", photoUrl: null }] } : s))} />
        </Sec>

        {copySec("money", "06", "Where your money goes", "The fee breakdown comes from step 2 and is always shown.")}
        {copySec("wall", "07", "The wall", "The wall fills itself as people give.")}

        <Sec fixed title="Story length" right={`${storyLen} / ${STORY_MIN} minimum`}
          sub={isStructured(pd)
            ? "Counts your full story below (minus its first paragraph once The need has an intro), plus the intros and box text above."
            : "Counts your full story below."} testId="section-story-length" />

        <details className="border-[1.5px] border-[#17100F] bg-[#FFFDF9] px-4 py-3.5 mb-2.5" data-testid="details-story-legacy">
          <summary className="cursor-pointer text-[15px] font-bold">Full story, money items and places</summary>
          <p className="text-[13px] text-[#5A4F4B] mt-1 mb-4">Your longer story and places stay here. Money items feed The programme until you edit its boxes above.</p>
          <LegacyStoryFields {...props} />
        </details>
      </div>
      {campaign && <CampaignLivePreview d={d} campaign={campaign} org={org} />}
    </div>
    </div>
  );
}
