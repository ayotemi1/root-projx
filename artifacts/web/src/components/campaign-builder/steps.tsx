import { acceptPatch } from "./assist-logic";
import { AccumulationField } from "@/components/campaign/accumulation-field";
import { Plus, Trash2, Info, Captions } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { CampaignUnit } from "@/lib/api";
import { AssistButton, Counter, FieldBlock, MediaUpload } from "./fields";
import { BUILTIN_UNITS, MAX_LOCATIONS, STORY_MIN, TAGLINE_MAX, type CampaignDraft } from "./model";

export interface StepProps {
  d: CampaignDraft;
  update: (patch: Partial<CampaignDraft>) => void;
  token: string;
  campaignId: string;
  assistEnabled: boolean;
  /** Flush the draft before any writing-help request (draft.flush). */
  beforeAssist?: () => Promise<boolean>;
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function Choice({ active, onClick, title, body, testId }: { active: boolean; onClick: () => void; title: string; body: string; testId: string }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active} data-testid={testId}
      className={`text-left p-3.5 rounded-xl border-2 transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
    >
      <span className={`block font-bold text-sm ${active ? "text-primary" : "text-foreground"}`}>{title}</span>
      <span className="block text-xs text-muted-foreground mt-0.5">{body}</span>
    </button>
  );
}

export function StepBasics({ d, update, token, campaignId, assistEnabled, beforeAssist }: StepProps) {
  return (
    <div className="space-y-6">
      <FieldBlock label="Campaign name" htmlFor="cb-name">
        <Input id="cb-name" value={d.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. A roof for the Kibera reading room" data-testid="input-campaign-name" data-tour-id="campaign-name" />
      </FieldBlock>
      <FieldBlock
        label="One-line ask" htmlFor="cb-tagline"
        hint="This is the line people see on the share card. Say what a gift does."
        counter={<Counter id="cb-tagline-count" n={d.tagline.length} max={TAGLINE_MAX} />}
        error={d.tagline.length > TAGLINE_MAX ? `Shorten by ${d.tagline.length - TAGLINE_MAX} characters.` : null}
      >
        <Textarea id="cb-tagline" rows={2} value={d.tagline} onChange={(e) => update({ tagline: e.target.value })} aria-describedby="cb-tagline-count" aria-invalid={d.tagline.length > TAGLINE_MAX} placeholder="Help 30 children read after school with a dry, lit room." data-testid="input-campaign-tagline" data-tour-id="campaign-tagline" />
        <AssistButton beforeRequest={beforeAssist} enabled={assistEnabled} campaignId={campaignId} field="tagline" token={token} fieldLabel="your one-line ask" onAccept={(t) => update(acceptPatch(d, "tagline", t, 0, TAGLINE_MAX))} />
      </FieldBlock>
      <div className="space-y-2" data-tour-id="campaign-type">
        <p className="text-sm font-semibold">What kind of campaign?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Choice active={d.type === "fundraising"} onClick={() => update({ type: "fundraising" })} title="Fundraising" body="Collect donations towards a goal." testId="button-type-fundraising" />
          <Choice active={d.type === "volunteer"} onClick={() => update({ type: "volunteer" })} title="Volunteer" body="Recruit people to give their time." testId="button-type-volunteer" />
        </div>
      </div>
    </div>
  );
}

export function StepMoney({ d, update }: StepProps) {
  const goal = Number(d.goal) || 0;
  const partner = Number(d.partnerAmount) || 0;
  return (
    <div className="space-y-6">
      <FieldBlock label="Goal amount" htmlFor="cb-goal" hint="The full amount the work costs, in pounds.">
        <div className="relative" data-tour-id="campaign-goal">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
          <Input id="cb-goal" inputMode="decimal" value={d.goal} onChange={(e) => update({ goal: e.target.value.replace(/[^\d.]/g, "") })} className="pl-7" placeholder="4800" data-testid="input-campaign-goal" />
        </div>
      </FieldBlock>
      {d.type === "volunteer" && (
        <FieldBlock label="Volunteers needed" htmlFor="cb-vol">
          <Input id="cb-vol" inputMode="numeric" value={d.volunteersNeeded} onChange={(e) => update({ volunteersNeeded: e.target.value.replace(/\D/g, "") })} placeholder="12" data-testid="input-campaign-volunteers" />
        </FieldBlock>
      )}
      <div className="rounded-xl border border-border p-4 space-y-4" data-tour-id="campaign-match-funding">
        <div className="space-y-2">
          <p id="cb-partner-q" className="text-sm font-semibold">Is a funding partner involved?</p>
          <p className="text-xs text-muted-foreground">For example a foundation, embassy or business. Most groups don't have one yet, and that's fine.</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="cb-partner-q">
            {(["yes", "no"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={d.partnerAnswer === v}
                onClick={() => update({ partnerAnswer: v, partnerOn: v === "yes" })}
                className={`h-11 rounded-lg border-2 text-sm font-bold ${d.partnerAnswer === v ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground/80 hover:border-primary/40"}`}
                data-testid={`button-partner-${v}`} data-tour-id={`campaign-match-${v}`}>
                {v === "yes" ? "Yes" : "No partner"}
              </button>
            ))}
          </div>
        </div>
        {d.partnerOn && (
          <div className="space-y-4">
            <div className="grid gap-2" role="radiogroup" aria-label="Kind of partner funding">
              {([
                ["committed", "Someone has already committed funding to this"],
                ["matching", "Someone will match what donors give"],
              ] as const).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={d.partnerType === v}
                  onClick={() => update({ partnerType: v })}
                  className={`min-h-11 px-3 py-2 rounded-lg border-2 text-sm font-semibold text-left ${d.partnerType === v ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground/80 hover:border-primary/40"}`}
                  data-testid={`button-partner-type-${v}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock label={d.partnerType === "matching" ? "Total pledged for matching" : "Amount committed"} htmlFor="cb-partner-amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                  <Input id="cb-partner-amount" inputMode="decimal" className="pl-7" value={d.partnerAmount} onChange={(e) => update({ partnerAmount: e.target.value.replace(/[^\d.]/g, "") })} data-testid="input-partner-amount" />
                </div>
              </FieldBlock>
              <FieldBlock label="Funding partner" htmlFor="cb-partner-funder">
                <Input id="cb-partner-funder" value={d.partnerFunder} onChange={(e) => update({ partnerFunder: e.target.value })} placeholder="the High Commission of Canada" data-testid="input-partner-funder" />
              </FieldBlock>
              {d.partnerType === "matching" && (
                <>
                  <FieldBlock label="They add, for every £1 donors give" htmlFor="cb-partner-ratio">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                      <Input id="cb-partner-ratio" inputMode="decimal" className="pl-7" value={d.partnerRatio} onChange={(e) => update({ partnerRatio: e.target.value.replace(/[^\d.]/g, "") })} placeholder="1" data-testid="input-partner-ratio" />
                    </div>
                  </FieldBlock>
                  <FieldBlock label="Most they will match (optional)" htmlFor="cb-partner-cap">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                      <Input id="cb-partner-cap" inputMode="decimal" className="pl-7" value={d.partnerCap} onChange={(e) => update({ partnerCap: e.target.value.replace(/[^\d.]/g, "") })} placeholder={d.partnerAmount || "same as pledged"} data-testid="input-partner-cap" />
                    </div>
                  </FieldBlock>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {d.partnerType === "matching"
                ? "Donors see what their gift adds, only while matching funds are left. Once the cap is used, the page says matching has been fully claimed. Cards are only ever charged what the donor gives."
                : `Donors see this as money already committed, alongside what is raised here and what is still needed.${goal > 0 && partner > 0 ? ` Still needed before any donations: £${Math.max(0, goal - partner).toLocaleString("en-GB")}.` : ""}`}
            </p>
          </div>
        )}
      </div>
      <FieldBlock label="Deadline (optional)" htmlFor="cb-deadline">
        <Input id="cb-deadline" type="date" value={d.deadline} onChange={(e) => update({ deadline: e.target.value })} className="max-w-[220px]" data-testid="input-campaign-deadline" />
      </FieldBlock>
    </div>
  );
}

export function StepStory({ d, update, token, campaignId, assistEnabled, beforeAssist }: StepProps) {
  const len = d.description.trim().length;
  const setBreak = (i: number, patch: Partial<CampaignDraft["breakdown"][number]>) =>
    update({ breakdown: d.breakdown.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const setLoc = (i: number, patch: Partial<CampaignDraft["locations"][number]>) =>
    update({ locations: d.locations.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <div className="space-y-8">
      <FieldBlock
        label="Your story" htmlFor="cb-story"
        hint="Who is this for, what changes, and why now. Plain words read best on a phone."
        counter={<Counter id="cb-story-count" n={len} min={STORY_MIN} />}
      >
        <Textarea id="cb-story" rows={9} value={d.description} onChange={(e) => update({ description: e.target.value })} aria-describedby="cb-story-count" data-testid="input-campaign-story" data-tour-id="campaign-story" />
        <AssistButton beforeRequest={beforeAssist} enabled={assistEnabled} campaignId={campaignId} field="description" token={token} fieldLabel="your story" onAccept={(t) => update(acceptPatch(d, "description", t))} />
      </FieldBlock>

      <section className="space-y-3" data-tour-id="campaign-breakdown">
        <div>
          <h3 className="text-sm font-semibold">What the money buys</h3>
          <p className="text-xs text-muted-foreground">Concrete beats abstract: "30 places on the programme", "£12 buys a week of meals".</p>
        </div>
        {d.breakdown.map((b, i) => (
          <div key={i} className="rounded-xl border border-border p-3 space-y-2" data-testid={`row-edit-breakdown-${i}`}>
            <div className="flex gap-2">
              <Input aria-label={`Item ${i + 1} amount or quantity`} value={b.label} onChange={(e) => setBreak(i, { label: e.target.value })} placeholder="£25 or 30 places" className="flex-1 min-w-0" data-testid={`input-breakdown-label-${i}`} />
              <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground" onClick={() => update({ breakdown: d.breakdown.filter((_, j) => j !== i) })} aria-label={`Remove item ${i + 1}`} data-testid={`button-remove-breakdown-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Textarea rows={2} aria-label={`Item ${i + 1} what it covers`} value={b.detail} onChange={(e) => setBreak(i, { detail: e.target.value })} placeholder="childcare for single mothers on site" data-testid={`input-breakdown-detail-${i}`} />
            <AssistButton beforeRequest={beforeAssist} enabled={assistEnabled} campaignId={campaignId} field="breakdown.detail" token={token} fieldLabel="this item" testSuffix={String(i)} onAccept={(t) => update(acceptPatch(d, "breakdown.detail", t, i))} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => update({ breakdown: [...d.breakdown, { label: "", detail: "" }] })} data-testid="button-add-breakdown">
          <Plus className="w-4 h-4 mr-1" /> Add an item
        </Button>
      </section>

      <section className="space-y-3" data-tour-id="campaign-locations">
        <div>
          <h3 className="text-sm font-semibold">Where it happens</h3>
          <p className="text-xs text-muted-foreground">Up to {MAX_LOCATIONS} places, each with a line of description and an optional photo.</p>
        </div>
        {d.locations.map((l, i) => (
          <div key={i} className="rounded-xl border border-border p-3 space-y-2" data-testid={`row-edit-location-${i}`}>
            <div className="flex gap-2">
              <Input aria-label={`Location ${i + 1} name`} value={l.name} onChange={(e) => setLoc(i, { name: e.target.value })} placeholder="Mathare community hall" className="flex-1 min-w-0" data-testid={`input-location-name-${i}`} />
              <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground" onClick={() => update({ locations: d.locations.filter((_, j) => j !== i) })} aria-label={`Remove location ${i + 1}`} data-testid={`button-remove-location-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Input aria-label={`Location ${i + 1} description`} value={l.description} onChange={(e) => setLoc(i, { description: e.target.value })} placeholder="Where the Saturday classes meet" data-testid={`input-location-description-${i}`} />
            <AssistButton beforeRequest={beforeAssist} enabled={assistEnabled} campaignId={campaignId} field="locations.description" token={token} fieldLabel="this location" testSuffix={String(i)} onAccept={(t) => update(acceptPatch(d, "locations.description", t, i))} />
            <MediaUpload id={`location-photo-${i}`} label="Add a photo (optional)" accept={IMAGE_ACCEPT} url={l.photoUrl} token={token} aspect="aspect-[16/10]" onUploaded={(u) => setLoc(i, { photoUrl: u })} onRemove={() => setLoc(i, { photoUrl: null })} />
          </div>
        ))}
        {d.locations.length < MAX_LOCATIONS && (
          <Button type="button" variant="outline" size="sm" onClick={() => update({ locations: [...d.locations, { name: "", description: "", photoUrl: null }] })} data-testid="button-add-location">
            <Plus className="w-4 h-4 mr-1" /> Add a location
          </Button>
        )}
      </section>
    </div>
  );
}

function UnitSample({ unit, colour }: { unit: CampaignUnit; colour: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/40 bg-[#FFF9F2] p-4" data-testid="preview-unit-sample" data-tour-id="campaign-unit-sample">
      <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest bg-foreground text-background px-2 py-0.5 rounded">Sample</span>
      <div className="mt-3 rounded-xl overflow-hidden">
        <AccumulationField key={unit.imageUrl ?? "dot"} count={24} unitSingular={unit.singular || "unit"} unitPlural={unit.plural || "units"}
          imageUrl={unit.imageUrl} colour={colour} accent="#F5C200" background={`${colour}0D`} height={150} testId="canvas-unit-sample" />
      </div>
      <p className="text-sm font-semibold mt-3">Every donor adds one {unit.singular || "unit"}.</p>
      <p className="text-xs text-muted-foreground">Illustration only. Your page will show real {unit.plural || "units"} as gifts arrive.</p>
    </div>
  );
}

export function StepLook({ d, update, token }: StepProps) {
  const builtin = BUILTIN_UNITS.find((u) => d.unit?.imageUrl === u.imageUrl);
  const custom = !!d.unit && !builtin;
  const colourKeys: Array<[keyof CampaignDraft["colours"], string]> = [
    ["primaryColor", "Primary"], ["accentColor", "Accent"], ["backgroundColor", "Background"], ["textColor", "Text"],
  ];
  return (
    <div className="space-y-8">
      <FieldBlock label="Hero image" hint="Required to publish. 1600 x 1200 works well; keep faces near the centre.">
        <MediaUpload id="hero" label="Upload a hero image" accept={IMAGE_ACCEPT} url={d.imageUrl} token={token} tourId="campaign-hero" onUploaded={(u) => update({ imageUrl: u })} onRemove={() => update({ imageUrl: null })} />
      </FieldBlock>

      <section className="rounded-xl border border-border p-4 space-y-4" data-tour-id="campaign-video">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="cb-video-on" className="text-sm font-semibold">Add a video</label>
          <Switch id="cb-video-on" checked={d.videoOn} onCheckedChange={(v) => update({ videoOn: v })} data-testid="switch-video" />
        </div>
        {d.videoOn && (
          <div className="space-y-4">
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
              <Captions className="w-4 h-4 shrink-0" /> Most people watch with the sound off. Add captions so your video still lands.
            </p>
            <FieldBlock label="YouTube or Vimeo link" htmlFor="cb-video-url" hint="Or upload a file below. The video only loads when someone taps play.">
              <Input id="cb-video-url" type="url" inputMode="url" value={d.videoUrl} onChange={(e) => update({ videoUrl: e.target.value })} placeholder="https://youtu.be/..." data-testid="input-video-url" />
            </FieldBlock>
            <MediaUpload id="video-file" kind="video" label="Upload a video file" accept="video/mp4,video/webm,video/quicktime" url={null} token={token} onUploaded={(u) => update({ videoUrl: u })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock label="Poster frame">
                <MediaUpload id="video-poster" label="Upload poster" accept={IMAGE_ACCEPT} aspect="aspect-video" url={d.videoPoster} token={token} onUploaded={(u) => update({ videoPoster: u })} onRemove={() => update({ videoPoster: null })} />
              </FieldBlock>
              <FieldBlock label="Captions file (.vtt)" hint="For uploaded videos. YouTube and Vimeo keep their own captions.">
                <MediaUpload id="video-captions" kind="file" label="Upload captions" accept=".vtt,text/vtt" url={d.videoCaptions} token={token} onUploaded={(u) => update({ videoCaptions: u })} onRemove={() => update({ videoCaptions: null })} />
              </FieldBlock>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3" data-tour-id="campaign-unit">
        <div>
          <h3 className="text-sm font-semibold">What does each donor add?</h3>
          <p className="text-xs text-muted-foreground">Pick a countable thing for this campaign. Every donor adds one.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Unit">
          {BUILTIN_UNITS.map((u) => {
            const active = builtin?.id === u.id;
            return (
              <button key={u.id} type="button" role="radio" aria-checked={active} onClick={() => update({ unit: { singular: u.singular, plural: u.plural, imageUrl: u.imageUrl }, unitChosen: true })}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                data-testid={`button-unit-${u.id}`} data-tour-id={`campaign-unit-${u.id}`}>
                <img src={u.imageUrl} alt="" className="w-12 h-12" />
                <span className="text-xs font-bold capitalize">{u.singular}</span>
              </button>
            );
          })}
          <button type="button" role="radio" aria-checked={custom} onClick={() => update({ unit: { singular: d.unit?.singular ?? "", plural: d.unit?.plural ?? "", imageUrl: custom ? d.unit!.imageUrl : null }, unitChosen: true })}
            className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-dashed transition-colors ${custom ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            data-testid="button-unit-custom" data-tour-id="campaign-unit-custom">
            <Plus className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs font-bold">Your own</span>
          </button>
        </div>
        {d.unit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock label="One" htmlFor="cb-unit-s">
              <Input id="cb-unit-s" value={d.unit.singular} onChange={(e) => update({ unit: { ...d.unit!, singular: e.target.value } })} placeholder="coconut" data-testid="input-unit-singular" />
            </FieldBlock>
            <FieldBlock label="Many" htmlFor="cb-unit-p">
              <Input id="cb-unit-p" value={d.unit.plural} onChange={(e) => update({ unit: { ...d.unit!, plural: e.target.value } })} placeholder="coconuts" data-testid="input-unit-plural" />
            </FieldBlock>
            {custom && (
              <div className="sm:col-span-2">
                <FieldBlock label="Image for your unit" hint="A square picture works best.">
                  <MediaUpload id="unit-image" label="Upload unit image" accept={IMAGE_ACCEPT} aspect="aspect-square max-w-[160px]" url={d.unit.imageUrl} token={token} onUploaded={(u) => update({ unit: { ...d.unit!, imageUrl: u } })} onRemove={() => update({ unit: { ...d.unit!, imageUrl: null } })} />
                </FieldBlock>
              </div>
            )}
            <div className="sm:col-span-2"><UnitSample unit={d.unit} colour={d.colours.primaryColor} /></div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Page colours</h3>
        <div className="grid grid-cols-2 gap-3">
          {colourKeys.map(([k, label]) => (
            <div key={k} className="flex items-center gap-2 min-w-0">
              <input type="color" aria-label={`${label} colour`} value={d.colours[k]} onChange={(e) => update({ colours: { ...d.colours, [k]: e.target.value } })} className="w-8 h-8 rounded cursor-pointer shrink-0" data-testid={`input-colour-${k}`} />
              <span className="text-xs text-muted-foreground truncate">{label} <span className="font-mono">{d.colours[k]}</span></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
